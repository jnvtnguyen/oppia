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

// List of directories to exclude from the search.
const SEARCH_EXCLUSIONS = [
  'node_modules',
  'dist',
  'build',
  'types',
  'typings',
  'local_compiled_js_for_test',
  'third_party',
  'webpack_bundles',
  'scripts',
  '.direnv',
  'backend_prod_files',
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

const ROOT_DIRECTORY = path.resolve(__dirname, '../../');

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
   * Checks if the given file has a module declaration.
   */
  private doesFileHaveModuleDeclaration(filePath: string): boolean {
    const fileAngularInformations =
      this.fileAngularInformationsMapping[filePath];
    if (!fileAngularInformations) return false;
    return fileAngularInformations.some(info => info.type === 'module');
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

    sourceFile.forEachChild(node => {
      let modulePath: string | undefined;
      if (ts.isImportDeclaration(node)) {
        modulePath =
          this.typescriptExtractorUtilities.resolveExpressionIntoString(
            node.moduleSpecifier.getText(sourceFile)
          );
      }
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression)
      ) {
        if (node.expression.expression.getText(sourceFile) !== 'require') {
          return;
        }
        modulePath =
          this.typescriptExtractorUtilities.resolveExpressionIntoString(
            node.expression.arguments[0].getText(sourceFile)
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
      if (
        this.doesFileHaveModuleDeclaration(filePath) &&
        !this.doesFileHaveModuleDeclaration(resolvedModulePath)
      ) {
        return;
      }
      fileDepedencies.push(resolvedModulePath);
    });

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

export class DepedencyGraphGenerator {
  typescriptHost: ts.CompilerHost;
  typescriptConfig: any;
  files: string[];
  dependenciesMapping: Record<string, string[]> = {};
  dependencyGraph: Record<string, string[]> = {};

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
        filePath.includes('puppeteer-acceptance-tests') ||
        (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js'))
      ) {
        acc.push(path.relative(ROOT_DIRECTORY, filePath));
      }
      return acc;
    }, []);
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
  private getFilesWithDepedency(depedencyFilePath: string): string[] {
    return Object.keys(this.dependenciesMapping).filter(key =>
      this.dependenciesMapping[key].includes(depedencyFilePath)
    );
  }

  /**
   * Finds the root depedencies for the given file.
   */
  private getRootDepedenciesForFile(
    filePath: string,
    fileAngularInformationMapping: Record<string, AngularInformation[]>,
    visited: Set<string> = new Set<string>(),
  ): string[] {
    if (visited.has(filePath)) {
      return [];
    }
    visited.add(filePath);

    const depedencies = this.getFilesWithDepedency(filePath);
    if (depedencies.length === 0) {
      if (filePath.endsWith('root.component.ts')) {
        return [filePath.replace('root.component.ts', '.module.ts')];
      }
      if (filePath.endsWith('.import.ts')) {
        return [filePath.replace('.import.ts', '.module.ts')];
      }
      if (filePath.endsWith('.mainpage.html')) {
        return [filePath.replace('.mainpage.html', '.module.ts')];
      }
      return [filePath];
    }

    const rootFiles: string[] = [];
    for (const depedency of depedencies) {
      rootFiles.push(...this.getRootDepedenciesForFile(
        depedency, fileAngularInformationMapping, visited));
    }

    return Array.from(new Set(rootFiles));
  }

  /**
   * Generates the depedency graph.
   */
  public generateDepedencyGraph(): Record<string, string[]> {
    const fileAngularInformationsMapping =
      this.getFileAngularInformationsMapping();
    const dependencyExtractor = new DependencyExtractor(
      this.typescriptHost,
      this.typescriptConfig,
      fileAngularInformationsMapping
    );

    for (const filePath of this.files) {
      this.dependenciesMapping[filePath] =
        dependencyExtractor.extractDepedenciesFromFile(filePath);
    }

    for (const filePath of this.files) {
      this.dependencyGraph[filePath] = this.getRootDepedenciesForFile(
        filePath, fileAngularInformationsMapping);
    }

    return this.dependencyGraph;
  }
}

const depedencyGraphGenerator = new DepedencyGraphGenerator();
const depedencyGraph = depedencyGraphGenerator.generateDepedencyGraph();
fs.writeFileSync(
  path.resolve(ROOT_DIRECTORY, 'dependency-graph.json'),
  JSON.stringify(depedencyGraph, null, 2)
);
