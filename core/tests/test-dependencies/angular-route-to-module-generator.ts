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
 * @fileoverview This script is used to generate an Angular route to module mapping.
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
    'core/templates/pages/creator-dashboard-page/creator-dashboard-page.import.ts',
  ],
  [
    {
      path: 'create/:exploration_id',
    },
    'core/templates/pages/exploration-editor-page/exploration-editor-page.import.ts',
  ],
  [
    {
      path: 'emaildashboardresult/:query_id',
    },
    'core/templates/pages/email-dashboard-pages/email-dashboard-result-page.import.ts',
  ],
  [
    {
      path: 'learn/:classroom_url_fragment/:topic_url_fragment/practice/session',
    },
    'core/templates/pages/practice-session-page/practice-session-page.import.ts',
  ],
  [
    {
      path: 'topics-and-skills-dashboard',
    },
    'core/templates/pages/topics-and-skills-dashboard-page/topics-and-skills-dashboard-page.import.ts',
  ],
  [
    {
      path: 'topic_editor/:topic_id',
    },
    'core/templates/pages/topic-editor-page/topic-editor-page.import.ts',
  ],
  [
    {
      path: 'story_editor/:story_id',
    },
    'core/templates/pages/story-editor-page/story-editor-page.import.ts',
  ],
  [
    {
      path: 'contributor-dashboard',
    },
    'core/templates/pages/contributor-dashboard-page/contributor-dashboard-page.import.ts',
  ],
  [
    {
      path: 'skill_editor/:skill_id',
    },
    'core/templates/pages/skill-editor-page/skill-editor-page.import.ts',
  ],
  [
    {
      path: 'learn/:classroom_url_fragment/:topic_url_fragment/review-test/:story_id',
    },
    'core/templates/pages/review-test-page/review-test-page.import.ts',
  ],
  [
    {
      path: 'learn/:classroom_url_fragment/:topic_url_fragment/revision/:story_id',
    },
    'core/templates/pages/subtopic-viewer-page/subtopic-viewer-page.import.ts',
  ],
  [
    {
      path: 'learn/:classroom_url_fragment/:topic_url_fragment/story',
    },
    'core/templates/pages/topic-viewer-page/topic-viewer-page.import.ts',
  ],
]);

export class AngularRouteToModuleGenerator {
  typescriptHost: ts.CompilerHost;
  typescriptExtractorUtilities: TypescriptExtractorUtilities =
    new TypescriptExtractorUtilities();

  constructor() {
    this.typescriptHost = this.typescriptExtractorUtilities.getTypescriptHost();
  }

  private getRootExpressionFromPropertyAccessExpression(
    node: any
  ): ts.PropertyAccessExpression {
    if (ts.isPropertyAccessExpression(node.expression)) {
      return this.getRootExpressionFromPropertyAccessExpression(node.expression);
    }
    return node;
  }

  private isRouteDuplicateInMap(
    route: Route,
    angularRouteToModuleMapping: Map<Route, string>
  ): boolean {
    for (const [existingRoute, _] of angularRouteToModuleMapping) {
      if (existingRoute.path === route.path) {
        return true;
      }
    }
    return false;
  }

  private parseRouteObjectToMapValue(
    node: any,
    routingModuleSourceFile: ts.SourceFile,
    routingModuleFilePath,
    parentPath?: string,
    parentModulePath?: string
  ): Map<Route, string> {
    let angularRouteToModuleMapping: Map<Route, string> = new Map();
    let constantsClone: any = {...constants};
    let routePath: string | undefined = undefined;
    let pathMatch: string | undefined = undefined;
    let module: string | undefined = undefined;
    let component: boolean = false;

    // We iterate over the properties of each route.
    for (const property of node.properties) {
      const propertyName = property.name.getText(routingModuleSourceFile);
      if (propertyName === 'path') {
        try {
          // First try evaluting the path property, if it is evaluable then
          // we can directly use it as the route path.
          routePath = this.typescriptExtractorUtilities.evaluateNode(
            property.initializer
          );
        } catch (error) {
          const rootInitializer = this.getRootExpressionFromPropertyAccessExpression(
            property.initializer
          );
          if (rootInitializer.expression.getText(routingModuleSourceFile) !== 'AppConstants') {
            throw new Error(
              `Failed to parse path property from ${routingModuleFilePath}. Please ensure that the 
                path property is a string literal or a property from the AppConstants object.`
            );
          }
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
          routePath = constantsClone;
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
              parentPath ? `${parentPath}${routePath}` : routePath,
              parentModulePath
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
      } else if (propertyName === 'component') {
        component = true;
      }
    }
    if (typeof routePath === 'string' && module) {
      const routeFullPath = parentPath ? `${parentPath}${routePath}` : routePath;
      angularRouteToModuleMapping.set(
        {
          path: routeFullPath,
          pathMatch,
        },
        module
      );
      const fullModulePath = path.join(ROOT_DIRECTORY, module);
      const moduleSourceFile = this.typescriptHost.getSourceFile(
        fullModulePath,
        ts.ScriptTarget.ES2020
      );
      if (!moduleSourceFile) {
        throw new Error(`Failed to load source file: ${fullModulePath}.`);
      }
      const moduleRoutes = this.getAngularRoutesToModuleMappingFromFile(
        fullModulePath,
        moduleSourceFile,
        routeFullPath,
        module
      );
      for (const [route, modulePath] of moduleRoutes) {
        if (!this.isRouteDuplicateInMap(route, angularRouteToModuleMapping)) {
          angularRouteToModuleMapping.set(route, modulePath);
        }
      }
    }
    if (component && parentModulePath) {
      angularRouteToModuleMapping.set(
        {
          path: parentPath ? `${parentPath}${routePath}` : routePath,
          pathMatch,
        },
        parentModulePath
      );
    }
    return angularRouteToModuleMapping;
  }

  private getRoutesElementsFromClassDeclaration(
    node: ts.ClassDeclaration,
    routingModuleSourceFile: ts.SourceFile
  ): ts.NodeArray<ts.Node> | undefined {
    const decorators = node.decorators;
    if (!decorators) {
      return undefined;
    }
    for (const decorator of decorators) {
      if (!ts.isCallExpression(decorator.expression)) {
        return undefined;
      }
      const expression = decorator.expression;
      if (expression.expression.getText(routingModuleSourceFile) === 'NgModule') {
        const argument: any = expression.arguments[0];
        const importsArgument = argument.properties.find(
          (property: any) =>
            property.name.getText(routingModuleSourceFile) === 'imports'
        );
        const elements = importsArgument.initializer.elements;
        const routerModuleElement = elements.find(
          (element: any) => {
            if (!ts.isCallExpression(element)) {
              return false;
            }
            if (!ts.isPropertyAccessExpression(element.expression)) {
              return false;
            }
            return element.expression.expression.getText(routingModuleSourceFile) ===
              'RouterModule'
          }
        );
        if (!routerModuleElement) {
          return undefined;
        }
        if (routerModuleElement.expression.name.getText(routingModuleSourceFile) != 'forRoot' &&
            routerModuleElement.expression.name.getText(routingModuleSourceFile) != 'forChild'
        ) {
          return undefined;
        }
        const routesArgument = routerModuleElement.arguments[0];
        // There are two cases, one where the routes are an identifier and the other
        // where the routes are an array.
        if (ts.isIdentifier(routesArgument)) {
          const routesArgumentName = routesArgument.getText(routingModuleSourceFile);
          let routeElements = undefined;
          routingModuleSourceFile.forEachChild((child: any) => {
            if (ts.isVariableStatement(child)) {
              const declaration: any = child.declarationList.declarations[0];
              const declarationName = declaration.name.getText(
                routingModuleSourceFile
              );
              if (declarationName === routesArgumentName) {
                routeElements = declaration.initializer.elements;
                return;
              }
            }
          });
          return routeElements;
        } else if(ts.isArrayLiteralExpression(routesArgument)) {
          return routesArgument.elements;
        }
      }
    }
    return undefined;
  }

  private getRoutesElementsFromFile(
    routingModuleSourceFile: ts.SourceFile
  ): ts.NodeArray<ts.Node> | undefined {
    let routeElements: ts.NodeArray<ts.Node> | undefined = undefined;
    routingModuleSourceFile.forEachChild((node: any) => {
      if (ts.isClassDeclaration(node)) {
        routeElements = this.getRoutesElementsFromClassDeclaration(
          node,
          routingModuleSourceFile
        );
        return;
      }
    });
    return routeElements;
  }

  private getAngularRoutesToModuleMappingFromFile(
    filePath: string,
    routingModuleSourceFile: ts.SourceFile,
    parentPath?: string,
    parentModulePath?: string
  ): Map<Route, string> {
    let routeElements = this.getRoutesElementsFromFile(routingModuleSourceFile);
    let angularRouteToModuleMapping: Map<Route, string> = new Map();
    if (!routeElements) {
      return angularRouteToModuleMapping;
    }
    for (const element of routeElements) {
      angularRouteToModuleMapping = new Map([
        ...this.parseRouteObjectToMapValue(
          element, 
          routingModuleSourceFile, 
          filePath, 
          parentPath,
          parentModulePath
        ),
        ...angularRouteToModuleMapping,
      ]);
    }
    return angularRouteToModuleMapping;
  }

  public getAngularRouteToModuleMapping(): Map<Route, string> {
    let angularRouteToModuleMapping: Map<Route, string> = new Map([
      ...MANUAL_ROUTE_TO_MODULE_MAPPING,
    ]);
    for (const routingModuleFilePath of ROUTING_MODULES) {
      const appRoutingModuleSourceFile = this.typescriptHost.getSourceFile(
        routingModuleFilePath,
        ts.ScriptTarget.ES2020
      );

      if (!appRoutingModuleSourceFile) {
        throw new Error(`Failed to load source file: ${routingModuleFilePath}`);
      }
      const routesToModuleMapping = this.getAngularRoutesToModuleMappingFromFile(
        routingModuleFilePath,
        appRoutingModuleSourceFile
      );
      angularRouteToModuleMapping = new Map([
        ...routesToModuleMapping,
        ...angularRouteToModuleMapping,
      ]);
    }

    return angularRouteToModuleMapping;
  }
}
