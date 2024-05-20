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
 * @fileoverview This script is used to generate a URL to Angular module mapping.
 */

import path from 'path';
import ts from 'typescript';
import {Route} from '@angular/router';
import {TypescriptExtractorUtilities, ROOT_DIRECTORY} from './typescript-extractor-utilities';
import constants from '../../../assets/constants';

const APP_ROUTING_MODULE_FILE_PATH = path.resolve(
  ROOT_DIRECTORY,
  'core/templates/pages/oppia-root/routing/app.routing.module.ts'
);

const MANUAL_ROUTE_TO_MODULE_MAPPING: Map<Route, string> = new Map([]);

export class AngularRouteToModuleGenerator {
  typescriptHost: ts.CompilerHost;
  typescriptExtractorUtilities: TypescriptExtractorUtilities =
    new TypescriptExtractorUtilities();

  constructor() {
    this.typescriptHost = this.typescriptExtractorUtilities.getTypescriptHost();
  }

  public getAngularRouteToModuleMapping(): Map<Route, string> {
    const angularRouteToModuleMapping: Map<Route, string> = new Map(
      MANUAL_ROUTE_TO_MODULE_MAPPING
    );
    const appRoutingModuleSourceFile = this.typescriptHost.getSourceFile(
      APP_ROUTING_MODULE_FILE_PATH,
      ts.ScriptTarget.ES2020
    );

    if (!appRoutingModuleSourceFile) {
      throw new Error(
        `Failed to load source file: ${APP_ROUTING_MODULE_FILE_PATH}`
      );
    }

    appRoutingModuleSourceFile.forEachChild((node: any) => {
      // First we look for the actual routes variable statement.
      if (ts.isVariableStatement(node)) {
        const declaration: any = node.declarationList.declarations[0];
        const declarationName = declaration.name.getText(
          appRoutingModuleSourceFile
        );
        if (declarationName !== 'routes') {
          return;
        }
        // This array contains all the routes defined in the app routing module.
        const arrayElements = declaration.initializer.elements;
        for (const element of arrayElements) {
          let constantsClone: any = {...constants};
          let url: string | undefined;
          let pathMatch: string | undefined;
          let module: string | undefined;

          // We iterate over the properties of each route.
          for (const property of element.properties) {
            const propertyName = property.name.getText(
              appRoutingModuleSourceFile
            );
            if (propertyName === 'path') {
              // If we are parsing the path property we need to iterate over the
              // different accessors into the constants object using a stack.
              const stack: string[] = [];
              let initializer = property.initializer;
              while (initializer.expression) {
                stack.push(
                  initializer.name.getText(appRoutingModuleSourceFile)
                );
                initializer = initializer.expression;
              }
              while (stack.length) {
                const accessor = stack.pop();
                if (accessor) {
                  constantsClone = constantsClone[accessor];
                }
              }
              url = constantsClone;
            } else if (propertyName === 'pathMatch') {
              pathMatch = this.typescriptExtractorUtilities.evaluateNode(
                property.initializer
              );
            } else if (propertyName === 'loadChildren') {
              const importModule = this.typescriptExtractorUtilities.evaluateNode(
                property.initializer.body.expression.expression.arguments[0]);
              if (importModule) {
                const resolvedModulePath =
                  this.typescriptExtractorUtilities.resolveModule(
                    importModule,
                    APP_ROUTING_MODULE_FILE_PATH
                  );
                module = resolvedModulePath;
              }
            }
          }
          if (url && module) {
            angularRouteToModuleMapping.set({path: url, pathMatch}, module);
          }
        }
      }
    });

    return angularRouteToModuleMapping;
  }
}
