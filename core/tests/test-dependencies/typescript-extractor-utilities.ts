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
 * @fileoverview General utilities for extracting TypeScript code.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {evaluate} from 'ts-evaluator';

// List of Webpack Definied Aliases defined in webpack.config.ts.
const WEBPACK_DEFINED_ALIASES = {
  'assets/constants': ['assets/constants.ts'],
  'assets/rich_text_component_definitions': [
    'assets/rich_text_components_definitions.ts',
  ],
  assets: ['assets'],
  'core/templates': ['core/templates'],
  extensions: ['extensions'],
};

// List of built in node modules.
const BUILT_IN_NODE_MODULES = ['fs', 'path', 'console', 'child_process'];

/**
 * Gets the root directory of the project by traversing up the directory tree
 * until a 'package.json' file is found.
 */
const getRootDirectory = (): string => {
  let currentDirectory = __dirname;
  while (!fs.existsSync(path.join(currentDirectory, 'package.json'))) {
    currentDirectory = path.resolve(currentDirectory, '..');
  }
  return currentDirectory;
};
export const ROOT_DIRECTORY = getRootDirectory();
const TYPESCRIPT_CONFIG_PATH = path.resolve(ROOT_DIRECTORY, 'tsconfig.json');

export class TypescriptExtractorUtilities {
  typescriptConfig: any;

  constructor() {
    this.typescriptConfig = ts.readConfigFile(
      TYPESCRIPT_CONFIG_PATH,
      ts.sys.readFile
    ).config;
  }

  /**
   * Returns the TypeScript compiler host.
   */
  public getTypescriptHost = (): ts.CompilerHost => {
    return ts.createCompilerHost(this.typescriptConfig);
  };

  /**
   * Resolves a TypeScript/JavaScript expression into a regular string.
   */
  public evaluateNode = (
    node: ts.Statement | ts.Declaration | ts.Expression
  ): string | undefined => {
    const response = evaluate({node});
    if (!response.success) {
      throw new Error(`Failed to evaluate node: ${response}`);
    }
    return response.value as string;
  };

  /*
   * Provided a file path without an extension, it returns the file path with the
   * extension '.ts' or '.js' if it exists.
   */
  public getFilePathWithExtension = (path: string): string => {
    if (fs.existsSync(path + '.ts')) return path + '.ts';
    if (fs.existsSync(path + '.js')) return path + '.js';
    return path;
  };

  /**
   * Checks if a file is a lib or not.
   */
  public isFilePathALib(filePath: string): boolean {
    let rootFilePath = filePath;
    if (filePath.includes('/')) {
      rootFilePath = filePath.substring(0, filePath.indexOf('/'));
    }
    if (BUILT_IN_NODE_MODULES.includes(rootFilePath)) {
      return true;
    }
    return fs.existsSync(
      path.resolve(ROOT_DIRECTORY, 'node_modules', rootFilePath)
    );
  }

  /**
   * Checks if a file path is relative or not.
   */
  public isFilePathRelative(filePath: string): boolean {
    return filePath.startsWith('.');
  }

  /**
   * Returns the path by alias using the TypeScript config, if it exists.
   */
  public resolvePathByAlias(filePath: string): string | undefined {
    const aliases = {
      ...this.typescriptConfig.compilerOptions.paths,
      ...WEBPACK_DEFINED_ALIASES,
    };

    for (const aliasPath of Object.keys(aliases)) {
      const formattedAliasPath = aliasPath.replace('/*', '');
      if (filePath.startsWith(formattedAliasPath)) {
        const fullAliasPath = aliases[aliasPath][0].replace('/*', '');
        return filePath.replace(formattedAliasPath, fullAliasPath);
      }
    }
    return undefined;
  }

  /**
   * Resolves a module path to a file path relative to the root directory.
   */
  public resolveModule(
    modulePath: string,
    relativeFilePath: string
  ): string | undefined {
    if (
      !this.isFilePathRelative(modulePath) &&
      this.isFilePathALib(modulePath)
    ) {
      return undefined;
    }
    const pathByAlias = this.resolvePathByAlias(modulePath);
    if (pathByAlias) {
      return this.getFilePathWithExtension(pathByAlias);
    }
    if (this.isFilePathRelative(modulePath)) {
      return this.getFilePathWithExtension(
        path.join(path.dirname(relativeFilePath), modulePath)
      );
    } else {
      return this.getFilePathWithExtension(
        path
          .resolve(ROOT_DIRECTORY, 'core/templates', modulePath)
          .replace(`${ROOT_DIRECTORY}/`, '')
      );
    }
  }
}
