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

import path from 'path';
import fs from 'fs';
import {Decorator, SourceFile, ts} from 'ts-morph';
import * as cheerio from 'cheerio';
import {
  project,
  ROOT_DIRECTORY,
  AngularDecorators,
  getRelativePathToRootDirectory,
  isNodeModule,
  getAllDecorationNodesByTextFromSourceFile,
  resolveModuleRelativeToRoot,
  getDecorationNodeText,
  getValueFromLiteralStringOrBinaryExpression,
} from './typescript-ast-utilities';

type BaseAngularInformation = {
  className: string;
};

type AngularModuleInformation = BaseAngularInformation & {
  type: 'module';
};

type AngularComponentInformation = BaseAngularInformation & {
  type: 'component';
  selector?: string;
  templateFilePath?: string;
};

type AngularDirectiveOrPipeInformation = BaseAngularInformation & {
  type: 'directive' | 'pipe';
  selector?: string;
};

type AngularInformation =
  | AngularModuleInformation
  | AngularComponentInformation
  | AngularDirectiveOrPipeInformation;

const GIT_IGNORED_EXCLUSIONS = fs
  .readFileSync(path.resolve(ROOT_DIRECTORY, '.gitignore'), 'utf-8')
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'));

const FILE_EXCLUSIONS = [
  ...GIT_IGNORED_EXCLUSIONS,
  'types',
  'typings',
  'scripts',
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
  'webpack.common.config.ts',
  'webpack.common.macros.ts',
  'webpack.dev.config.ts',
  'webpack.dev.sourcemap.config.ts',
  'webpack.prod.config.ts',
  'webpack.prod.sourcemap.config.ts',
  'angular-template-style-url-replacer.webpack-loader.js',
  'extensions/**/webdriverio.js',
];

const FILE_EXTENSIONS = [
  '.ts',
  '.js',
  '.html',
  '.md',
  '.css',
  'CODEOWNERS',
  'AUTHORS',
  'CONTRIBUTORS',
];

const TYPESCRIPT_JAVASCRIPT_EXTENSION = /.*\.(js|ts)$/;
const HTML_EXTENSION = /.*\.html$/;

const files = ts.sys
  .readDirectory(ROOT_DIRECTORY, FILE_EXTENSIONS, FILE_EXCLUSIONS, [])
  .reduce((acc: string[], filePath: string) => {
    acc.push(getRelativePathToRootDirectory(filePath));
    return acc;
  }, []);

/**
 * Gets all the module imports that are called using require or import in the
 * given source file.
 */
const getCallExpressionModuleImportsFromSourceFile = (
  sourceFile: SourceFile
): string[] => {
  const importAndRequireCallExpressions = sourceFile
    .getDescendantsOfKind(ts.SyntaxKind.CallExpression)
    .filter(callExpression => {
      const expression = callExpression.getExpression();
      return (
        expression.getText() === 'require' || expression.getText() === 'import'
      );
    });

  return importAndRequireCallExpressions.map(callExpression => {
    const moduleSpecifier = callExpression.getArguments()[0];
    if (!moduleSpecifier) {
      throw new Error(
        `No module specifier found in require or import call in ` +
          `${sourceFile.getFilePath()} with ${callExpression.getText()}`
      );
    }
    const moduleSpecifierValue =
      getValueFromLiteralStringOrBinaryExpression(moduleSpecifier);
    if (!moduleSpecifierValue) {
      throw new Error(
        `No module specifier value found in require or import call in ' + 
        '${callExpression.getText()} at ${sourceFile.getFilePath()}`
      );
    }
    return resolveModuleRelativeToRoot(
      moduleSpecifierValue,
      sourceFile.getFilePath()
    );
  });
};

/**
 * Gets all the module imports from the given source file.
 */
const getModuleImportsFromSourceFile = (sourceFile: SourceFile): string[] => {
  const importDeclarations = sourceFile.getImportDeclarations();
  const importModules = importDeclarations.map(importDeclaration => {
    return resolveModuleRelativeToRoot(
      importDeclaration.getModuleSpecifierValue(),
      sourceFile.getFilePath()
    );
  });

  const callExpressionImportModules =
    getCallExpressionModuleImportsFromSourceFile(sourceFile);

  return [...importModules, ...callExpressionImportModules].filter(
    module => !isNodeModule(module)
  );
};

/**
 * Gets the Angular informations from the given source file.
 */
const getAngularInformationsFromSourceFile = (
  sourceFile: SourceFile
): AngularInformation[] => {
  const decorationNodes: Decorator[] = [];
  for (const decorator in AngularDecorators) {
    decorationNodes.push(
      ...getAllDecorationNodesByTextFromSourceFile(sourceFile, decorator)
    );
  }

  return decorationNodes.map(decorationNode => {
    const decorationText = getDecorationNodeText(decorationNode);
    const className = decorationNode
      .getParent()
      .asKindOrThrow(ts.SyntaxKind.ClassDeclaration)
      .getNameOrThrow();
    const type =
      decorationText === AngularDecorators.Module
        ? 'module'
        : decorationText === AngularDecorators.Component
          ? 'component'
          : decorationText === AngularDecorators.Directive
            ? 'directive'
            : 'pipe';

    if (type === 'module') {
      return {
        type,
        className,
      };
    }

    const objectArgument = decorationNode.getArguments()[0];
    if (
      !objectArgument ||
      !objectArgument.isKind(ts.SyntaxKind.ObjectLiteralExpression)
    ) {
      throw new Error(
        `No object argument found in ${decorationText} on class ` +
          `${className} in ${sourceFile.getFilePath()}`
      );
    }

    const selectorProperty = objectArgument.getProperty('selector');
    const selector = selectorProperty
      ? selectorProperty
          .asKindOrThrow(ts.SyntaxKind.PropertyAssignment)
          .getInitializerOrThrow()
          .asKindOrThrow(ts.SyntaxKind.StringLiteral)
          .getLiteralValue()
      : undefined;
    if (type === 'directive' || type === 'pipe') {
      return {
        type,
        className,
        selector,
      };
    }

    const templateUrlProperty = objectArgument.getProperty('templateUrl');
    const templateUrl = templateUrlProperty
      ? templateUrlProperty
          .asKindOrThrow(ts.SyntaxKind.PropertyAssignment)
          .getInitializerOrThrow()
          .asKindOrThrow(ts.SyntaxKind.StringLiteral)
          .getLiteralValue()
      : undefined;

    return {
      type,
      className,
      selector,
      templateFilePath: templateUrl
        ? resolveModuleRelativeToRoot(templateUrl, sourceFile.getFilePath())
        : undefined,
    };
  });
};

/**
 * Gets the Angular informations from the given files.
 */
const getFileToAngularInformationsFromFiles = (
  files: string[]
): Map<string, AngularInformation[]> => {
  return files.reduce((acc, file) => {
    const sourceFile = project.addSourceFileAtPath(file);
    const angularInformations =
      getAngularInformationsFromSourceFile(sourceFile);
    acc.set(file, angularInformations);
    return acc;
  }, new Map<string, AngularInformation[]>());
};

/**
 * Checks if the given text contains a specific pipe selector.
 */
const isPipeSelectorPresentInText = (
  text: string,
  selector: string
): boolean => {
  return text.includes('|') && text.includes(selector);
};

/**
 * Gets the Angular dependencies from a HTML file.
 */
const getAngularDependenciesFromHtmlFile = (
  file: string,
  fileToAngularInformations: Map<string, AngularInformation[]>
): string[] => {
  const content = fs.readFileSync(file, 'utf-8');
  const $ = cheerio.load(content);

  $('*')
    .children()
    .each((_, element) => {
      Object.entries(element.attribs).forEach(([attribute, value]) => {
        if (
          (attribute.startsWith('[') && attribute.endsWith(']')) ||
          (attribute.startsWith('(') && attribute.endsWith(')'))
        ) {
          $(element).removeAttr(attribute);
          $(element).attr(attribute.slice(1, -1), value);
        }
      });
    });

  const dependencies: string[] = [];
  for (const [
    dependencyFile,
    dependencyAngularInformations,
  ] of fileToAngularInformations) {
    for (const dependencyAngularInformation of dependencyAngularInformations) {
      if (
        dependencyAngularInformation.type === 'module' ||
        dependencyAngularInformation.selector === undefined
      ) {
        continue;
      }

      const {selector, type} = dependencyAngularInformation;
      if (type === 'pipe') {
        $('*')
          .children()
          .each((_, element) => {
            const text = $(element).text();
            if (isPipeSelectorPresentInText(text, selector)) {
              dependencies.push(dependencyFile);
              return false;
            }
            for (const value of Object.values(element.attribs)) {
              if (isPipeSelectorPresentInText(value, selector)) {
                dependencies.push(dependencyFile);
                return false;
              }
            }
            return true;
          });
      } else if (
        (type === 'component' || type === 'directive') &&
        $(selector).length > 0
      ) {
        dependencies.push(dependencyFile);
      }
    }
  }

  return dependencies;
};

const getLoadDependenciesFromHtmlFile = (file: string): string[] => {
  const content = fs.readFileSync(file, 'utf-8');
  const $ = cheerio.load(content);
  const dependencies: string[] = [];

  $('*')
    .children()
    .each((_, element) => {
      const text = $(element).text();
      if (text.includes('@load')) {
        const loaders = text.split('\n').filter(line => line.includes('@load'));
        for (const loader of loaders) {
          const loaderModule = loader
            .substring(loader.indexOf('(') + 1, loader.indexOf(')'))
            .split(',')[0]
            .slice(1, -1);
          const loaderModulePath = resolveModuleRelativeToRoot(
            loaderModule,
            file
          );
          dependencies.push(loaderModulePath);
        }
      }
    });

  return dependencies;
};

/**
 * Gets the dependencies from a HTML file.
 */
const getDependenciesFromHtmlFile = (
  file: string,
  fileToAngularInformations: Map<string, AngularInformation[]>
): string[] => {
  return Array.from(
    new Set([
      ...getAngularDependenciesFromHtmlFile(file, fileToAngularInformations),
      ...getLoadDependenciesFromHtmlFile(file),
    ])
  );
};

/**
 * Gets the dependencies from a TypeScript or JavaScript file.
 */
const getDependenciesFromTypeScriptOrJavaScriptFile = (
  file: string,
  fileToAngularInformations: Map<string, AngularInformation[]>
): string[] => {
  const sourceFile = project.addSourceFileAtPath(file);
  const dependencies: string[] = [];
  dependencies.push(...getModuleImportsFromSourceFile(sourceFile));

  const angularInformations = fileToAngularInformations.get(file) || [];
  angularInformations.forEach(angularInformation => {
    if (
      angularInformation.type === 'component' &&
      angularInformation.templateFilePath
    ) {
      dependencies.push(angularInformation.templateFilePath);
    }
  });

  if (file.endsWith('.import.ts')) {
    const mainPageFilePath = file.replace('.import.ts', '.mainpage.html');
    if (fs.existsSync(path.join(ROOT_DIRECTORY, mainPageFilePath))) {
      dependencies.push(mainPageFilePath);
    }
  }

  return Array.from(new Set(dependencies));
};

/**
 * Gets the dependency mapping from the given files.
 */
const getDependencyMappingFromFiles = (
  files: string[]
): Map<string, string[]> => {
  const fileToAngularInformations =
    getFileToAngularInformationsFromFiles(files);

  return files.reduce((acc, file) => {
    if (TYPESCRIPT_JAVASCRIPT_EXTENSION.test(file)) {
      const dependencies = getDependenciesFromTypeScriptOrJavaScriptFile(
        file,
        fileToAngularInformations
      );
      acc.set(file, dependencies);
    } else if (HTML_EXTENSION.test(file)) {
      const dependencies = getDependenciesFromHtmlFile(
        file,
        fileToAngularInformations
      );
      acc.set(file, dependencies);
    }
    return acc;
  }, new Map<string, string[]>());
};
