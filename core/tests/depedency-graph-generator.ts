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
  readTypescriptConfig,
} from './typescript-extractor-utilities';

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

const ROOT_DIRECTORY = path.resolve(__dirname, '../../');

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
  'core/tests/build_sources',
  'core/tests/data',
  'core/tests/load_tests',
  'core/tests/release_sources',
  'core/tests/services_sources',
  'core/tests/webdriverio',
  'core/tests/webdriverio_desktop',
  'core/tests/webdriverio_utils',
  'core/tests/puppeteer-acceptance-tests/build',
  'core/tests/depedency-graph-generator.ts',
  'core/tests/test-url-to-angular-module-matcher.ts',
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
];

export class DependencyExtractor {
  typescriptHost: ts.CompilerHost;
  typescriptConfig: any;
  fileAngularInformationsMapping: Record<string, AngularInformation[]>;
  typescriptExtractorUtilities: TypescriptExtractorUtilities;

  constructor(
    typescriptHost: ts.CompilerHost,
    typescriptConfig: any,
    fileAngularInformationsMapping: Record<string, AngularInformation[]>
  ) {
    this.typescriptHost = typescriptHost;
    this.typescriptConfig = typescriptConfig;
    this.fileAngularInformationsMapping = fileAngularInformationsMapping;
    this.typescriptExtractorUtilities = new TypescriptExtractorUtilities(
      typescriptConfig
    );
  }

  /**
   * Extracts the depedencies from the given TypeScript or Javascript file.
   */
  private extractDepedenciesFromTypescriptOrJavascriptFile(
    filePath: string
  ): string[] {
    const sourceFile = this.typescriptHost.getSourceFile(
      filePath,
      ts.ScriptTarget.ES2020
    );
    if (!sourceFile) {
      throw new Error(`Failed to read source file: ${filePath}.`);
    }

    const fileAngularInformations =
      this.fileAngularInformationsMapping[filePath];
    const fileDepedencies: string[] = [];

    const visitNode = (node: ts.Node) => {
      ts.forEachChild(node, visitNode);
      let modulePath: string | undefined;
      if (ts.isImportDeclaration(node))  {
        modulePath =
          this.typescriptExtractorUtilities.resolveExpressionIntoString(
            node.moduleSpecifier.getText(sourceFile)
          );
      }
      let callExpression: ts.Expression | undefined;
      if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];
        if (ts.isVariableDeclaration(declaration)) {
          callExpression = declaration.initializer;
        }
      } else if (ts.isExpressionStatement(node)) {
        callExpression = node.expression;
      }
      if (callExpression && ts.isCallExpression(callExpression)) {
        if (
          callExpression.expression.getText(sourceFile) !== 'require' ||
          callExpression.expression.getText(sourceFile) !== 'import'
        ) {
          return;
        }
        modulePath =
          this.typescriptExtractorUtilities.resolveExpressionIntoString(
            callExpression.arguments[0].getText(sourceFile)
          );
      }
      if (!modulePath) return;

      const resolvedModulePath =
        this.typescriptExtractorUtilities.resolveModulePathToFilePath(
          modulePath,
          filePath
        );
      if (!resolvedModulePath) return;
      if (!fs.existsSync(path.join(ROOT_DIRECTORY, resolvedModulePath))) {
        throw new Error(
          `The module with path: ${resolvedModulePath}, does not exist, occured at ${filePath}.`
        );
      }
      fileDepedencies.push(resolvedModulePath);
    };

    sourceFile.forEachChild((node) => {
      visitNode(node);
    });

    // We need to add the mainpage file as a depedency if the file is an import file since
    // it is loaded by Webpack.
    if (filePath.endsWith('.import.ts')) {
      const mainpageFilePath = filePath.replace('.import.ts', '.mainpage.html');
      if (fs.existsSync(path.join(ROOT_DIRECTORY, mainpageFilePath))) {
        fileDepedencies.push(mainpageFilePath);
      }
    }

    for (const fileAngularInformation of fileAngularInformations) {
      if (fileAngularInformation.type === 'component') {
        fileDepedencies.push(fileAngularInformation.templateUrl);
      }
    }

    return Array.from(new Set(fileDepedencies));
  }

  /**
   * Extracts the depedencies from the given HTML file.
   */
  private extractDepedenciesFromHTMLFile(filePath: string): string[] {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const document = cheerio.load(fileContent);
    const fileDepedencies: string[] = [];
    document('*')
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
            document(element).removeAttr(attributeName);
            document(element).attr(attributeName.slice(1, -1), attributeValue);
          }
        }
        // Here we check if the element has a load function.
        const elementText = document(element).text();
        if (elementText.includes('@load')) {
          const loadFunctions = elementText
            .split('\n')
            .filter(line => line.includes('@load'));
          for (const loadFunction of loadFunctions) {
            const args = loadFunction.substring(
              loadFunction.indexOf('(') + 1,
              loadFunction.indexOf(')')
            );
            const loadFilePath =
              this.typescriptExtractorUtilities.resolveExpressionIntoString(
                args.split(',')[0]
              );
            const resolvedLoadFilePath =
              this.typescriptExtractorUtilities.resolveModulePathToFilePath(
                loadFilePath,
                filePath
              );
            if (resolvedLoadFilePath) {
              fileDepedencies.push(resolvedLoadFilePath);
            }
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
          document('*')
            .children()
            .each((_, element) => {
              const elementText = document(element).text();
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
            });
        } else if (
          fileAngularInformation.type === 'component' ||
          fileAngularInformation.type === 'directive'
        ) {
          depedencyIsPresent =
            document(fileAngularInformation.selector).length > 0;
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
    if (!ts.isObjectLiteralExpression(expression)) return;
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (
        ts.isIdentifier(property.name) &&
        property.name.getText(sourceFile) === propertyName
      ) {
        return this.typescriptExtractorUtilities.resolveExpressionIntoString(
          property.initializer.getText(sourceFile)
        );
      }
    }
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
            this.typescriptExtractorUtilities.resolveModulePathToFilePath(
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
  typescriptConfig: any;
  files: string[];
  dependenciesMapping: Record<string, string[]> = {};
  dependencyGraph: Record<string, string[]> = {};
  fileAngularInformationsMapping: Record<string, AngularInformation[]>;

  constructor() {
    const typescriptConfigPath = path.resolve(ROOT_DIRECTORY, 'tsconfig.json');
    this.typescriptConfig = readTypescriptConfig(typescriptConfigPath);
    this.typescriptHost = ts.createCompilerHost(this.typescriptConfig);

    this.files = this.typescriptHost.readDirectory!(
      ROOT_DIRECTORY,
      SEARCH_FILE_EXTENSIONS,
      SEARCH_EXCLUSIONS,
      []
    ).reduce((acc: string[], filePath: string) => {
      if (
        (filePath.includes('puppeteer-acceptance-tests') ||
          (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js'))) &&
        !filePath.includes('webdriverio.js')
      ) {
        acc.push(path.relative(ROOT_DIRECTORY, filePath));
      }
      return acc;
    }, []);

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
        this.typescriptConfig,
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
    ignoreModules: boolean = true,
    visited: Set<string> = new Set()
  ): string[] {
    if (visited.has(filePath)) {
      return [];
    }
    visited.add(filePath);

    let references = this.getFilesWithDepedency(filePath, ignoreModules);
    if (references.length === 0 && ignoreModules) {
      ignoreModules = false;
      references = this.getFilesWithDepedency(filePath, ignoreModules);
    }

    if (references.length === 0) {
      return [filePath];
    }

    const rootReferences: string[] = [];
    for (const reference of references) {
      rootReferences.push(
        ...this.getRootDepedenciesForFile(reference, ignoreModules, visited)
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
      this.typescriptConfig,
      this.fileAngularInformationsMapping
    );

    for (const filePath of this.files) {
      this.dependenciesMapping[filePath] =
        dependencyExtractor.extractDepedenciesFromFile(filePath);
    }

    fs.writeFileSync(
      path.resolve(ROOT_DIRECTORY, '_dependency-graph.json'),
      JSON.stringify(this.dependenciesMapping, null, 2)
    );

    for (const filePath of this.files) {
      let ignoreModules = true;
      if (this.fileAngularInformationsMapping[filePath].some(
        (information) => information.type === 'module')
      ) {
        ignoreModules = false;
      }
      this.dependencyGraph[filePath] = this.getRootDepedenciesForFile(
        filePath, ignoreModules);
    }

    return this.dependencyGraph;
  }
}

const dependencyGraphGenerator = new DependencyGraphGenerator();
const dependencyGraph = dependencyGraphGenerator.generateDepedencyGraph();
fs.writeFileSync(
  path.resolve(ROOT_DIRECTORY, 'dependency-graph.json'),
  JSON.stringify(dependencyGraph, null, 2)
);
