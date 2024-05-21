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
import {
  TypescriptExtractorUtilities,
  ROOT_DIRECTORY,
} from './typescript-extractor-utilities';
import constants from '../../../assets/constants';

const ROUTING_MODULES = [
  path.resolve(
    ROOT_DIRECTORY,
    'core/templates/pages/oppia-root/routing/app.routing.module.ts'
  ),
  path.resolve(
    ROOT_DIRECTORY,
    'core/templates/pages/lightweight-oppia-root/routing/app.routing.module.ts'
  ),
];

const MANUAL_ROUTE_TO_MODULE_MAPPING: Map<Route, string> = new Map([
  [
    {
      path: 'creator-dashboard',
    },
    'core/templates/pages/creator-dashboard-page/creator-dashboard-page.import.ts'
  ],
  [
    {
      path: 'create/:exploration_id',
    },
    'core/templates/pages/exploration-editor-page/exploration-editor-page.import.ts'
  ],
  [
    {
      path: 'topics-and-skills-dashboard',
    },
    'core/templates/pages/topics-and-skills-dashboard-page/topics-and-skills-dashboard-page.import.ts'
  ],
  [
    {
      path: 'topic_editor/:topic_id',
    },
    'core/templates/pages/topic-editor-page/topic-editor-page.import.ts'
  ],
  [
    {
      path: 'story_editor/:story_id',
    },
    'core/templates/pages/story-editor-page/story-editor-page.import.ts'
  ],
  [
    {
      path: 'contributor-dashboard',
    },
    'core/templates/pages/contributor-dashboard-page/contributor-dashboard-page.import.ts'
  ],
  [
    {
      path: 'skill_editor/:skill_id',
    },
    'core/templates/pages/skill-editor-page/skill-editor-page.import.ts'
  ],
  [
    {
      path: 'learn/:classroom_url_fragment/:topic_url_fragment/story',
    },
    'core/templates/pages/topic-viewer-page/topic-viewer-page.import.ts'
  ]
]);

export class AngularRouteToModuleGenerator {
  typescriptHost: ts.CompilerHost;
  typescriptExtractorUtilities: TypescriptExtractorUtilities =
    new TypescriptExtractorUtilities();

  constructor() {
    this.typescriptHost = this.typescriptExtractorUtilities.getTypescriptHost();
  }

  private parseRouteObjectToMapValue(
    node: any,
    routingModuleSourceFile: ts.SourceFile,
    routingModuleFilePath,
    parentPath?: string
  ): Map<Route, string> {
    let angularRouteToModuleMapping: Map<Route, string> = new Map();
    let constantsClone: any = {...constants};
    let path: string | undefined;
    let pathMatch: string | undefined;
    let module: string | undefined;

    // We iterate over the properties of each route.
    for (const property of node.properties) {
      const propertyName = property.name.getText(routingModuleSourceFile);
      if (propertyName === 'path') {
        try {
          path = this.typescriptExtractorUtilities.evaluateNode(
            property.initializer
          );
        } catch (error) {
          // If we are parsing the path property we need to iterate over the
          // different accessors into the constants object using a stack.
          const stack: string[] = [];
          let initializer = property.initializer;
          while (initializer.expression) {
            stack.push(initializer.name.getText(routingModuleSourceFile));
            initializer = initializer.expression;
          }
          while (stack.length) {
            const accessor = stack.pop();
            if (accessor) {
              constantsClone = constantsClone[accessor];
            }
          }
          path = constantsClone;
        }
      } else if (propertyName === 'pathMatch') {
        pathMatch = this.typescriptExtractorUtilities.evaluateNode(
          property.initializer
        );
      } else if (propertyName === 'children') {
        for (const child of property.initializer.elements) {
          angularRouteToModuleMapping = new Map([
            ...this.parseRouteObjectToMapValue(
              child,
              routingModuleSourceFile,
              routingModuleFilePath,
              parentPath ? `${parentPath}${path}` : path
            ),
            ...angularRouteToModuleMapping,
          ]);
        }
      } else if (propertyName === 'loadChildren') {
        const importModule = this.typescriptExtractorUtilities.evaluateNode(
          property.initializer.body.expression.expression.arguments[0]
        );
        if (importModule) {
          const resolvedModulePath =
            this.typescriptExtractorUtilities.resolveModule(
              importModule,
              routingModuleFilePath
            );
          module = resolvedModulePath;
        }
      }
    }
    if (typeof path === 'string' && module) {
      angularRouteToModuleMapping.set(
        {
          path: parentPath ? `${parentPath}${path}` : path,
          pathMatch,
        },
        module
      );
    }
    return angularRouteToModuleMapping;
  }

  public getAngularRouteToModuleMapping(): Map<Route, string> {
    let angularRouteToModuleMapping: Map<Route, string> = new Map([
      ...MANUAL_ROUTE_TO_MODULE_MAPPING
    ]);
    for (const routingModuleFilePath of ROUTING_MODULES) {
      const appRoutingModuleSourceFile = this.typescriptHost.getSourceFile(
        routingModuleFilePath,
        ts.ScriptTarget.ES2020
      );

      if (!appRoutingModuleSourceFile) {
        throw new Error(`Failed to load source file: ${routingModuleFilePath}`);
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
            angularRouteToModuleMapping = new Map([
              ...this.parseRouteObjectToMapValue(
                element,
                appRoutingModuleSourceFile,
                routingModuleFilePath
              ),
              ...angularRouteToModuleMapping,
            ]);
          }
        }
      });
    }

    return angularRouteToModuleMapping;
  }
}
