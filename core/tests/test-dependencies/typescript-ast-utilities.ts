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
 * @fileoverview Utilities to work with TypeScript AST.
 */

import path from 'path';
import fs from 'fs';
import { Decorator, Project, SourceFile, ts } from "ts-morph";

export const ROOT_DIRECTORY = (() => {
  let current = __dirname;
  while (!fs.existsSync(path.join(current, 'package.json'))) {
    current = path.dirname(current);
  }
  return current;
})();

export const project = new Project({
  tsConfigFilePath: path.join(ROOT_DIRECTORY, 'tsconfig.json'),
  resolutionHost: () => {
    return {
      resolveModuleNames(moduleNames, containingFile) {
        return moduleNames.map(moduleName => {
          return resolveModule(moduleName, containingFile);
        });
      },
    };
  }
});

/**
 * Returns the path relative to the root directory.
 */
export const getRelativePath = (filePath: string): string => {
  return path.relative(ROOT_DIRECTORY, filePath);
}

/**
 * Resolves a module path.
 */
export const resolveModule = (
  modulePath: string,
  containingFile: string,
): ts.ResolvedModuleFull => {
  const moduleResolutionHost = project.getModuleResolutionHost();
  const resolved = ts.resolveModuleName(
    modulePath,
    containingFile,
    project.getCompilerOptions(),
    moduleResolutionHost
  );
  if (resolved.resolvedModule === undefined) {
    throw new Error(`Could not resolve module ${modulePath}.`);
  }
  return resolved.resolvedModule;
};

/**
 * Resolves a module path relative to the root directory.
 */
export const resolveModuleRelativeToRoot = (
  modulePath: string,
  containingFile: string,
): string => {
  return getRelativePath(resolveModule(modulePath, containingFile).resolvedFileName);
}

/**
 * Gets the main Angular module decoration node from a source file.
 */
export const getDecorationNodeByTextFromSourceFile = (
  sourceFile: SourceFile,
  text: string
): Decorator | undefined => {
  return sourceFile.getDescendantsOfKind(ts.SyntaxKind.Decorator)
    .find(decorator => {
      const expression = decorator.getExpression();
      if (expression === undefined) {
        return false;
      }
      const expressionText = expression.getText();
      return expressionText.includes(text);
    });
}
