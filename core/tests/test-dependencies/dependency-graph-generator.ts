// Copyright 2024 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Script to generate the dependency graph of the Oppia codebase.
 */

import ts from 'typescript';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import {
  TypescriptExtractorUtilities,
  ROOT_DIRECTORY,
} from './typescript-extractor-utilities';
import {AngularRouteToModuleGenerator} from './angular-route-to-module-generator';

type BaseAngularInformation = {
  className: string;
};

type AngularModuleInformation = BaseAngularInformation & {
  type: 'module';
};

// This type is specific to Angular component files.
type AngularComponentInformation = BaseAngularInformation & {
  type: 'component';
  selector: string;
  templateUrl: string;
};

// This type is specific to Angular directive or pipe files.
type AngularDirectiveOrPipeInformation = BaseAngularInformation & {
  type: 'directive' | 'pipe';
  selector: string;
};

type AngularInformation =
  | AngularModuleInformation
  | AngularComponentInformation
  | AngularDirectiveOrPipeInformation;

// List of exclusions from the .gitignore file.
const GIT_IGNORE_EXCLUSIONS = fs
  .readFileSync(path.resolve(ROOT_DIRECTORY, '.gitignore'), 'utf8')
  .split('\n')
  .filter(line => line && !line.startsWith('#'));

// List of directories to exclude from the search.
const SEARCH_EXCLUSIONS = [
  ...GIT_IGNORE_EXCLUSIONS,
  'types',
  'typings',
  'scripts',
  '.direnv',
  'src',
  'core/tests/build_sources',
  'core/tests/data',
  'core/tests/load_tests',
  'core/tests/release_sources',
  'core/tests/services_sources',
  'core/tests/webdriverio',
  'core/tests/webdriverio_desktop',
  'core/tests/webdriverio_utils',
  'core/tests/wdio.conf.js',
  'core/tests/test-dependencies',
  'core/templates/services/UpgradedServices.ts',
  'core/templates/services/angular-services.index.ts',
  'core/templates/utility/hashes.ts',
  'core/templates/pages/oppia-root',
  'webpack.common.config.ts',
  'webpack.common.macros.ts',
  'webpack.dev.config.ts',
  'webpack.dev.sourcemap.config.ts',
  'webpack.prod.config.ts',
  'webpack.prod.sourcemap.config.ts',
  'angular-template-style-url-replacer.webpack-loader.js',
];

// List of file extensions to to include in the search.
const SEARCH_FILE_EXTENSIONS = [
  '.ts',
  '.js',
  '.html',
  '.md',
  '.css',
  'CODEOWNERS',
  'AUTHORS',
  'CONTRIBUTORS'
];

// List of file extensions to exclude from the search.
const SEARCH_EXCLUDED_FILE_EXTENSIONS = [
  '.guard.ts'
];

// List of manually mapped dependencies.
const MANUALLY_MAPPED_DEPENDENCIES: Record<string, string[]> = {
  '.lighthouserc-base.js': [
    'puppeteer-login-script.js',
    'core/tests/puppeteer/lighthouse_setup.js'
  ]
};

export class DependencyExtractor {
  typescriptHost: ts.CompilerHost;
  fileAngularInformationsMapping: Record<string, AngularInformation[]>;
  typescriptExtractorUtilities: TypescriptExtractorUtilities =
    new TypescriptExtractorUtilities();

  constructor(
    typescriptHost: ts.CompilerHost,
    fileAngularInformationsMapping: Record<string, AngularInformation[]>
  ) {
    this.typescriptHost = typescriptHost;
    this.fileAngularInformationsMapping = fileAngularInformationsMapping;
  }

  /**
   * Extracts the depedencies from the given TypeScript or JavaScript file.
   */
  private extractDepedenciesFromTypescriptOrJavascriptFile(
    filePath: string
  ): string[] {
    const sourceFile = this.typescriptHost.getSourceFile(
      filePath,
      ts.ScriptTarget.ES2020
    );
    if (!sourceFile) {
      throw new Error(`Failed to read source file at ${filePath}.`);
    }

    const fileAngularInformations =
      this.fileAngularInformationsMapping[filePath];
    const fileDepedencies: string[] = [];

    const scrapeDependenciesFromNode = (node: ts.Node) => {
      ts.forEachChild(node, scrapeDependenciesFromNode);
      let modulePath: string | undefined;
      // If the node is an import statement, we extract the module path.
      if (ts.isImportDeclaration(node)) {
        modulePath = this.typescriptExtractorUtilities.evaluateNode(
          node.moduleSpecifier
        );
      }
      // If the node is a require or import function call, we extract the module path.
      if (ts.isCallExpression(node)) {
        if (
          node.expression.kind !== ts.SyntaxKind.RequireKeyword &&
          node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
          node.expression.getText(sourceFile) !== 'require'
        ) {
          return;
        }
        modulePath = this.typescriptExtractorUtilities.evaluateNode(
          node.arguments[0]
        );
      }
      if (!modulePath) return;
      const resolvedModulePath =
        this.typescriptExtractorUtilities.resolveModule(modulePath, filePath);
      if (!resolvedModulePath) return;
      if (!fs.existsSync(path.join(ROOT_DIRECTORY, resolvedModulePath))) {
        throw new Error(
          `The module with path: ${resolvedModulePath}, does not exist, occured at ${filePath}.`
        );
      }
      fileDepedencies.push(resolvedModulePath);
    };

    sourceFile.forEachChild(node => {
      scrapeDependenciesFromNode(node);
    });

    // We need to add the mainpage file as a depedency if the file is an import file since
    // it is loaded by Webpack.
    if (filePath.endsWith('.import.ts')) {
      const mainpageFilePath = filePath.replace('.import.ts', '.mainpage.html');
      if (fs.existsSync(path.join(ROOT_DIRECTORY, mainpageFilePath))) {
        fileDepedencies.push(mainpageFilePath);
      }
    }

    // We need to add the template URL of the components as depedencies.
    for (const fileAngularInformation of fileAngularInformations) {
      if (fileAngularInformation.type === 'component') {
        fileDepedencies.push(fileAngularInformation.templateUrl);
      }
    }

    // We need to add the manually mapped dependencies.
    if (MANUALLY_MAPPED_DEPENDENCIES[filePath]) {
      fileDepedencies.push(...MANUALLY_MAPPED_DEPENDENCIES[filePath]);
    }

    return Array.from(new Set(fileDepedencies));
  }

  /**
   * Extracts the depedencies from the given HTML file.
   */
  private extractDepedenciesFromHTMLFile(filePath: string): string[] {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const cheerioDocument = cheerio.load(htmlContent);
    const fileDepedencies: string[] = [];
    cheerioDocument('*')
      .children()
      .each((_, element) => {
        // Here we replace any Angular binding attributes with regular attributes
        // since we cannot select them when there are brackets or parentheses.
        for (const [attributeName, attributeValue] of Object.entries(
          element.attribs
        )) {
          if (
            (attributeName.startsWith('[') && attributeName.endsWith(']')) ||
            (attributeName.startsWith('(') && attributeName.endsWith(')'))
          ) {
            cheerioDocument(element).removeAttr(attributeName);
            cheerioDocument(element).attr(
              attributeName.slice(1, -1),
              attributeValue
            );
          }
        }
        // Here we check if the element has a load function.
        const elementText = cheerioDocument(element).text();
        if (elementText.includes('@load')) {
          const loadFunctions = elementText
            .split('\n')
            .filter(line => line.includes('@load'));
          for (const loadFunction of loadFunctions) {
            const args = loadFunction.substring(
              loadFunction.indexOf('(') + 1,
              loadFunction.indexOf(')')
            );
            const loadFilePath = args.split(',')[0].slice(1, -1);
            const resolvedLoadFilePath =
              this.typescriptExtractorUtilities.resolveModule(
                loadFilePath,
                filePath
              );
            if (!resolvedLoadFilePath) {
              return;
            }
            fileDepedencies.push(resolvedLoadFilePath);
          }
        }
        const elementTag = element.tagName;
        if (elementTag === 'link' || elementTag === 'preload') {
          const elementHref = element.attribs.href;
          if (!elementHref.endsWith('.css')) {
            return;
          }
          if (!elementHref.startsWith('/templates/css')) {
            return;
          }
          const fullPath = 'core' + elementHref;
          if (!fs.existsSync(path.join(ROOT_DIRECTORY, fullPath))) {
            throw new Error(
              `The CSS file with path: ${fullPath}, does not exist, occured at ${filePath}.`
            );
          }
          fileDepedencies.push(fullPath);
        }
      });

    for (const [searchingFilePath, fileAngularInformations] of Object.entries(
      this.fileAngularInformationsMapping
    )) {
      for (const fileAngularInformation of fileAngularInformations) {
        let depedencyIsPresent = false;
        if (fileAngularInformation.type === 'pipe') {
          cheerioDocument('*')
            .children()
            .each((_, element) => {
              const elementText = cheerioDocument(element).text();
              if (
                elementText.includes('|') &&
                elementText.includes(fileAngularInformation.selector)
              ) {
                depedencyIsPresent = true;
                return false;
              }
              for (const attributeValue of Object.values(element.attribs)) {
                if (
                  attributeValue.includes('|') &&
                  attributeValue.includes(fileAngularInformation.selector)
                ) {
                  depedencyIsPresent = true;
                  return false;
                }
              }
              return true;
            });
        } else if (
          fileAngularInformation.type === 'component' ||
          fileAngularInformation.type === 'directive'
        ) {
          depedencyIsPresent =
            cheerioDocument(fileAngularInformation.selector).length > 0;
        }
        if (depedencyIsPresent) {
          fileDepedencies.push(searchingFilePath);
        }
      }
    }

    return Array.from(new Set(fileDepedencies));
  }

  /**
   * Gets the property value by its name from the given expression.
   */
  private getPropertyValueByNameFromExpression(
    expression: ts.Expression,
    propertyName: string,
    sourceFile: ts.SourceFile
  ): string | undefined {
    if (!ts.isObjectLiteralExpression(expression)) {
      return undefined;
    }
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (
        ts.isIdentifier(property.name) &&
        property.name.getText(sourceFile) === propertyName
      ) {
        return this.typescriptExtractorUtilities.evaluateNode(
          property.initializer
        );
      }
    }
    return undefined;
  }

  /**
   * Extracts the dependencies from the given file path.
   */
  public extractDepedenciesFromFile(filePath: string): string[] {
    const fileExtension = path.extname(filePath);
    if (fileExtension === '.ts' || fileExtension === '.js') {
      return this.extractDepedenciesFromTypescriptOrJavascriptFile(filePath);
    } else if (fileExtension === '.html') {
      return this.extractDepedenciesFromHTMLFile(filePath);
    } else {
      return [];
    }
  }

  /**
   * Extracts the Angular informations from the given file path.
   */
  public extractAngularInformationsFromFile(
    filePath: string
  ): AngularInformation[] {
    const sourceFile = this.typescriptHost.getSourceFile(
      filePath,
      ts.ScriptTarget.ES2020
    );
    if (!sourceFile) {
      throw new Error(`Failed to read source file: ${filePath}.`);
    }

    const fileAngularInformations: AngularInformation[] = [];
    sourceFile.forEachChild(node => {
      if (!ts.isClassDeclaration(node) || !node.decorators || !node.name)
        return;
      for (const decorator of node.decorators) {
        if (!ts.isCallExpression(decorator.expression)) continue;
        const decoratorText =
          decorator.expression.expression.getText(sourceFile);
        const className = node.name.getText(sourceFile);
        if (decoratorText === 'NgModule') {
          fileAngularInformations.push({
            type: 'module',
            className,
          });
        } else if (decoratorText === 'Component') {
          const selectorText = this.getPropertyValueByNameFromExpression(
            decorator.expression.arguments[0],
            'selector',
            sourceFile
          );
          const templateUrlText = this.getPropertyValueByNameFromExpression(
            decorator.expression.arguments[0],
            'templateUrl',
            sourceFile
          );
          if (!selectorText || !templateUrlText) continue;
          const resolvedTemplateUrl =
            this.typescriptExtractorUtilities.resolveModule(
              templateUrlText,
              filePath
            );
          if (!resolvedTemplateUrl) continue;
          fileAngularInformations.push({
            type: 'component',
            selector: selectorText,
            templateUrl: resolvedTemplateUrl,
            className,
          });
        } else if (decoratorText === 'Directive' || decoratorText === 'Pipe') {
          const selectorText = this.getPropertyValueByNameFromExpression(
            decorator.expression.arguments[0],
            'selector',
            sourceFile
          );
          if (!selectorText) continue;
          fileAngularInformations.push({
            type: decoratorText === 'Directive' ? 'directive' : 'pipe',
            selector: selectorText,
            className,
          });
        }
      }
    });

    return fileAngularInformations;
  }
}

export class DependencyGraphGenerator {
  typescriptHost: ts.CompilerHost;
  typescriptExtractorUtilities: TypescriptExtractorUtilities =
    new TypescriptExtractorUtilities();
  files: string[];
  fileAngularInformationsMapping: Record<string, AngularInformation[]>;
  angularPageModules: string[] = [];
  dependenciesMapping: Record<string, string[]> = {};
  dependencyGraph: Record<string, string[]> = {};

  constructor() {
    this.typescriptHost = this.typescriptExtractorUtilities.getTypescriptHost();
    this.files = this.typescriptHost.readDirectory!(
      ROOT_DIRECTORY,
      SEARCH_FILE_EXTENSIONS,
      SEARCH_EXCLUSIONS,
      []
    ).reduce((acc: string[], filePath: string) => {
      if (
        !filePath.includes('webdriverio.js')
        && !SEARCH_EXCLUDED_FILE_EXTENSIONS.some((extension) => filePath.endsWith(extension))
      ) {
        acc.push(path.relative(ROOT_DIRECTORY, filePath));
      }
      return acc;
    }, []);

    const angularRouteToModuleGenerator = new AngularRouteToModuleGenerator();
    this.angularPageModules = Array.from(
      angularRouteToModuleGenerator.getAngularRouteToModuleMapping().values()
    );
    this.fileAngularInformationsMapping =
      this.getFileAngularInformationsMapping();
  }

  /**
   * Gets the angular informations of the files.
   */
  private getFileAngularInformationsMapping(): Record<
    string,
    AngularInformation[]
  > {
    const fileAngularInformationsMapping: Record<string, AngularInformation[]> =
      {};
    for (const filePath of this.files) {
      const depedencyExtractor = new DependencyExtractor(
        this.typescriptHost,
        fileAngularInformationsMapping
      );
      fileAngularInformationsMapping[filePath] =
        depedencyExtractor.extractAngularInformationsFromFile(filePath);
    }

    return fileAngularInformationsMapping;
  }

  /**
   * Finds the files with the given depedency.
   */
  private getFilesWithDepedency(
    depedencyFilePath: string,
    ignoreModules: boolean = true
  ): string[] {
    return Object.keys(this.dependenciesMapping).filter(
      key =>
        this.dependenciesMapping[key].includes(depedencyFilePath) &&
        (!ignoreModules ||
          !this.fileAngularInformationsMapping[key].some(
            information => information.type === 'module'
          ))
    );
  }

  /**
   * Finds the root depedencies for the given file.
   */
  private getRootDepedenciesForFile(
    filePath: string,
    cache: Record<string, string[]> = {},
    ignoreModules: boolean = true,
    visited: Set<string> = new Set()
  ): string[] {
    if (cache[filePath]) {
      return cache[filePath];
    }
    if (visited.has(filePath)) {
      return [];
    }
    visited.add(filePath);

    let references = this.getFilesWithDepedency(filePath, ignoreModules);
    if (references.length === 0 && ignoreModules) {
      ignoreModules = false;
      references = this.getFilesWithDepedency(filePath, ignoreModules);
    }

    if (references.length === 0 || this.angularPageModules.includes(filePath)) {
      // Check if the page module has a upper import file.
      const upperReferences = this.getFilesWithDepedency(filePath, false);
      if (upperReferences.length && upperReferences[0].endsWith('.import.ts')) {
        return [upperReferences[0]];
      }
      return [filePath];
    }

    const rootReferences: string[] = [];
    for (const reference of references) {
      rootReferences.push(
        ...this.getRootDepedenciesForFile(reference, cache, ignoreModules, visited)
      );
    }

    return Array.from(new Set(rootReferences));
  }

  /**
   * Generates the depedency graph.
   */
  public generateDepedencyGraph(): Record<string, string[]> {
    const dependencyExtractor = new DependencyExtractor(
      this.typescriptHost,
      this.fileAngularInformationsMapping
    );

    for (const filePath of this.files) {
      this.dependenciesMapping[filePath] =
        dependencyExtractor.extractDepedenciesFromFile(filePath);
    }

    for (const filePath of this.files) {
      this.dependencyGraph[filePath] = this.getRootDepedenciesForFile(filePath, this.dependencyGraph);
    }

    const revisedDependencyGraph: Record<string, string[]> = {};
    for (const [file, rootFiles] of Object.entries(this.dependencyGraph)) {
      if (this.angularPageModules.some((module) => rootFiles.includes(module))) {
        revisedDependencyGraph[file] = this.dependencyGraph[file];
      } else {
        revisedDependencyGraph[file] = this.getRootDepedenciesForFile(file, revisedDependencyGraph, false);
      }
    }

    return revisedDependencyGraph;
  }
}

const dependencyGraphGenerator = new DependencyGraphGenerator();
const dependencyGraph = dependencyGraphGenerator.generateDepedencyGraph();
fs.writeFileSync(
  path.resolve(ROOT_DIRECTORY, 'dependency-graph.json'),
  JSON.stringify(dependencyGraph, null, 2)
);
