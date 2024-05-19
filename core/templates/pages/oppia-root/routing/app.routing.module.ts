// Copyright 2021 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Root routing module.
 */

import {APP_BASE_HREF} from '@angular/common';
import {NgModule} from '@angular/core';
import {Route, RouterModule} from '@angular/router';
import {routeDefinitions} from './app.route-definitions';

const routes: Route[] = [];
for (let i = 0; i < routeDefinitions.length; i++) {
  const routeDefinition = routeDefinitions[i];
  routes.push({
    path: routeDefinition.path,
    loadChildren: () =>
      import(routeDefinition.module).then(m => m[routeDefinition.class]),
    canActivate: routeDefinition.canActivate,
  });
}

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [
    {
      provide: APP_BASE_HREF,
      useValue: '/',
    },
  ],
})
export class AppRoutingModule {}
