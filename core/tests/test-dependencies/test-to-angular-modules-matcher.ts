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

const COMMON_EXCLUDED_MODULES: Record<string, string[]> = {
  'core/templates/pages/splash-page/splash-page.module.ts': [
    'core/tests/test-modules-mapping/lighthouse-accessibility/lighthouse-accessiblity.txt',
    'core/tests/test-modules-mapping/lighthouse-performance/lighthouse-performance.txt',
  ],
  'core/templates/pages/login-page/login-page.module.ts': [],
  'core/templates/pages/signup-page/signup-page.module.ts': [
    'core/tests/test-modules-mapping/lighthouse-accessibility/lighthouse-accessibility.txt',
    'core/tests/test-modules-mapping/lighthouse-performance/lighthouse-performance.txt',
  ],
  'core/templates/pages/admin-page/admin-page.module.ts': [
    'core/tests/test-modules-mapping/lighthouse-accessibility/lighthouse-accessibility.txt',
    'core/tests/test-modules-mapping/lighthouse-performance/lighthouse-performance.txt',
  ],
  'core/templates/pages/learner-dashboard-page/learner-dashboard-page.module.ts':
    [
      'core/tests/test-modules-mapping/lighthouse-accessibility/lighthouse-accessibility.txt',
      'core/tests/test-modules-mapping/lighthouse-performance/lighthouse-performance.txt',
    ],
};

export class TestToAngularModulesMatcher {
  static angularRouteToModuleMapping: Map<Route, string> =
    new AngularRouteToModuleGenerator().getAngularRouteToModuleMapping();
  static collectedTestAngularModules: string[] = [];
  static collectedTestErrors: string[] = [];
  static goldenFilePath: string;

  /**
   * Returns whether the provided URL matches the given Angular route.
   */
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

  /**
   * Registers a puppeteer browser to be used for getting a test's Angular modules.
   */
  public static registerPuppeteerBrowser(browser: any): void {
    browser.on('targetchanged', async target => {
      const page = await target.page();
      page.on('framenavigated', async frame => {
        TestToAngularModulesMatcher.registerUrl(frame.url());
      });
    });
  }

  /**
   * Sets the path to the file containing the mapping of Angular routes to
   * modules.
   */
  public static setGoldenFilePath(goldenFilePath: string): void {
    TestToAngularModulesMatcher.goldenFilePath = goldenFilePath;
  }

  /**
   * Registers a URL and adds the corresponding Angular module to the list of
   * collected modules.
   */
  public static registerUrl(url: string): void {
    if (!url.includes('http://localhost:8181/')) {
      return;
    }
    const urlWithoutHost = url.replace('http://localhost:8181/', '');
    let matched = false;
    for (const [
      route,
      module,
    ] of TestToAngularModulesMatcher.angularRouteToModuleMapping.entries()) {
      if (TestToAngularModulesMatcher.matchUrl(urlWithoutHost, route)) {
        matched = true;
        if (
          !TestToAngularModulesMatcher.collectedTestAngularModules.includes(
            module
          ) &&
          (!COMMON_EXCLUDED_MODULES[module] ||
            COMMON_EXCLUDED_MODULES[module].includes(
              TestToAngularModulesMatcher.goldenFilePath
            ))
        ) {
          TestToAngularModulesMatcher.collectedTestAngularModules.push(module);
        }
      }
    }

    if (!matched) {
      const errorMessage = `No Angular module found for the URL: ${url}.`;
      if (
        !TestToAngularModulesMatcher.collectedTestErrors.includes(errorMessage)
      ) {
        TestToAngularModulesMatcher.collectedTestErrors.push(errorMessage);
      }
    }
  }

  /**
   * Compares the collected Angular modules to the golden file.
   */
  public static compareAndOutputModules(): void {
    if (!TestToAngularModulesMatcher.goldenFilePath) {
      throw new Error('The golden file path has not been set.');
    }
    if (TestToAngularModulesMatcher.collectedTestErrors.length > 0) {
      throw new Error(
        TestToAngularModulesMatcher.collectedTestErrors.join('\n')
      );
    }
    let goldenFileContent = '';
    if (fs.existsSync(TestToAngularModulesMatcher.goldenFilePath)) {
      goldenFileContent = fs.readFileSync(
        TestToAngularModulesMatcher.goldenFilePath,
        'utf-8'
      );
    }
    const goldenModules = goldenFileContent
      .split('\n')
      .filter(line => line !== '');
    const missingModules =
      TestToAngularModulesMatcher.collectedTestAngularModules.filter(
        module => !goldenModules.includes(module)
      );
    const extraModules = goldenModules.filter(
      module =>
        !TestToAngularModulesMatcher.collectedTestAngularModules.includes(
          module
        )
    );
    const goldenFileBasePathWithoutExtension = path
      .basename(TestToAngularModulesMatcher.goldenFilePath)
      .split('.txt')[0];
    const generatedGoldenFilePath = path.resolve(
      path.dirname(TestToAngularModulesMatcher.goldenFilePath),
      `${goldenFileBasePathWithoutExtension}-generated.txt`
    );
    fs.mkdirSync(path.dirname(generatedGoldenFilePath), {recursive: true});
    fs.writeFileSync(
      generatedGoldenFilePath,
      TestToAngularModulesMatcher.collectedTestAngularModules.join('\n')
    );
    if (missingModules.length) {
      throw new Error(
        'The following Angular modules are missing from the golden file ' +
          `at the path ${TestToAngularModulesMatcher.goldenFilePath}:\n` +
          missingModules.join('\n')
      );
    }
    if (extraModules.length) {
      throw new Error(
        'The following Angular modules are extra in the golden file ' +
          `at the path ${TestToAngularModulesMatcher.goldenFilePath}:\n` +
          extraModules.join('\n')
      );
    }
  }
}
