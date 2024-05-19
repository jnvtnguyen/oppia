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
 * @fileoverview This script is used to match test URLs to their corresponding
 * Angular modules.
 */

import path from 'path';
import fs from 'fs';
import ts from 'typescript';
import {
  DefaultUrlSerializer,
  UrlSegment,
  UrlSegmentGroup,
  Route
} from '@angular/router';
import {
  TypescriptExtractorUtilities,
  readTypescriptConfig,
} from './typescript-extractor-utilities';
import {routeDefinitions} from
  '../../core/templates/pages/oppia-root/routing/app.route-definitions';

const ROOT_DIRECTORY = path.resolve(__dirname, '../../');

const ANGULAR_JS_URL_TO_MODULE_MAPPING = {};

export class TestToAngularModulesMatcher {
  typescriptHost: ts.CompilerHost;
  typescriptExtractorUtilities: TypescriptExtractorUtilities;
  urlToModuleMapping: Map<Route, string> = new Map();
  collectedTestAngularModules: string[] = [];

  constructor() {
    const typescriptConfigPath = path.resolve(ROOT_DIRECTORY, 'tsconfig.json');
    const typescriptConfig = readTypescriptConfig(typescriptConfigPath);
    this.typescriptHost = ts.createCompilerHost(typescriptConfig);
    this.typescriptExtractorUtilities = new TypescriptExtractorUtilities(
      typescriptConfig
    );
    this.urlToModuleMapping = {
      ...ANGULAR_JS_URL_TO_MODULE_MAPPING,
      ...this.getAngularUrlToModuleMapping(),
    };
  }

  private matchUrl(
    url: string,
    route: Route
  ): boolean {
    const urlSerializer = new DefaultUrlSerializer();
    const urlTree = urlSerializer.parse(url);
    const segments: UrlSegment[] = urlTree.root.children.primary.segments;
    const segmentGroup: UrlSegmentGroup = urlTree.root.children.primary;

    if (!route.path) {
      return false;
    }

    const parts = route.path.split('/');
    if (parts.length > segments.length) {
      return false;
    }

    if (
      route.pathMatch === 'full' &&
      (segmentGroup.hasChildren() || parts.length < segments.length)
    ) {
      return false;
    }

    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const segment = segments[index];
      const isParameter = part.startsWith(':');
      if (isParameter) {
        continue;
      } else if (part !== segment.path) {
        return false;
      }
    }

    return true;
  }

  private getAngularUrlToModuleMapping(): Map<Route, string> {
    const urlToAngularModuleMapping: Map<Route, string> = new Map();

    for (const routeDefinition of routeDefinitions) {
      urlToAngularModuleMapping.set({
        path: routeDefinition.path,
        pathMatch: routeDefinition.pathMatch,
      }, routeDefinition.module);
    }
    
    return urlToAngularModuleMapping;
  }

  public registerUrl(url: string): void {
    let matched = false;
    for (const [module, route] of Object.entries(this.urlToModuleMapping)) {
      if (
        this.matchUrl(url, route) &&
        !this.collectedTestAngularModules.includes(module)
      ) {
        this.collectedTestAngularModules.push(module);
        matched = true;
      }
    }

    if (!matched) {
      throw new Error(
        `No Angular module found for the URL: ${url}.`
      );
    }
  }

  public compareAndOutputModules(goldenFilePath: string): void {
    const goldenFileContent = fs.readFileSync(goldenFilePath, 'utf-8');
    const goldenModules = goldenFileContent.split('\n').filter(Boolean);
    const missingModules = goldenModules.filter(
      (module) => !this.collectedTestAngularModules.includes(module)
    );
    if (missingModules.length) {
      throw new Error(
        `The following Angular modules are missing from the golden file 
          at the path 
          ${goldenFilePath}:\n${missingModules.join('\n')}`
      )
    }
    const generatedGoldenFilePath = path.resolve(
      path.dirname(goldenFilePath),
      `generated-${path.basename(goldenFilePath)}`
    );
    fs.writeFileSync(generatedGoldenFilePath, this.collectedTestAngularModules.join('\n'));
  }
}
