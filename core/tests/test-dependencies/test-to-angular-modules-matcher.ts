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
import {
  DefaultUrlSerializer,
  UrlSegment,
  UrlSegmentGroup,
  Route,
} from '@angular/router';
import {AngularRouteToModuleGenerator} from './angular-route-to-module-generator';

export class TestToAngularModulesMatcher {
  static angularRouteToModuleMapping: Map<Route, string> =
    new AngularRouteToModuleGenerator().getAngularRouteToModuleMapping();
  static collectedTestAngularModules: string[] = [];
  static collectedTestErrors: string[] = [];

  private static matchUrl(url: string, route: Route): boolean {
    if (route.path === url) {
      return true;
    }
    const urlSerializer = new DefaultUrlSerializer();
    const urlTree = urlSerializer.parse(url);
    if (!urlTree.root.children.primary) {
      return false;
    }
    const segments: UrlSegment[] = urlTree.root.children.primary.segments;
    const segmentGroup: UrlSegmentGroup = urlTree.root.children.primary;

    if (route.path === undefined) {
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

  public static registerUrl(url: string): void {
    if (!url.includes('http://localhost:8181/')) {
      return;
    }
    const urlWithoutHost = url.replace('http://localhost:8181/', '');
    let matched = false;
    for (const [route, module] of TestToAngularModulesMatcher.angularRouteToModuleMapping.entries()) {
      if (
        TestToAngularModulesMatcher.matchUrl(urlWithoutHost, route)
      ) {
        matched = true;
        if (!TestToAngularModulesMatcher.collectedTestAngularModules.includes(module)) {
          TestToAngularModulesMatcher.collectedTestAngularModules.push(module);
        }
      }
    }

    console.log(matched)

    if (!matched) {
      const errorMessage = `No Angular module found for the URL: ${url}.`;
      if (!TestToAngularModulesMatcher.collectedTestErrors.includes(errorMessage)) {
        TestToAngularModulesMatcher.collectedTestErrors.push(errorMessage);
      }
    }
  }

  public static compareAndOutputModules(goldenFilePath: string): void {
    if (TestToAngularModulesMatcher.collectedTestErrors.length > 0) {
      throw new Error(TestToAngularModulesMatcher.collectedTestErrors.join('\n'));
    }

    const goldenFileContent = fs.readFileSync(goldenFilePath, 'utf-8');
    const goldenModules = goldenFileContent.split('\n').filter(Boolean);
    const missingModules = goldenModules.filter(
      module => !TestToAngularModulesMatcher.collectedTestAngularModules.includes(module)
    );
    if (missingModules.length) {
      throw new Error(
        `The following Angular modules are missing from the golden file 
          at the path 
          ${goldenFilePath}:\n${missingModules.join('\n')}`
      );
    }
    const generatedGoldenFilePath = path.resolve(
      path.dirname(goldenFilePath),
      `generated-${path.basename(goldenFilePath)}`
    );
    fs.writeFileSync(
      generatedGoldenFilePath,
      TestToAngularModulesMatcher.collectedTestAngularModules.join('\n')
    );
  }
}
