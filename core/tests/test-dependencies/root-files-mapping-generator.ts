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
 * @fileoverview Script to generate a files to root files mapping for the
 * Oppia codebase.
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
import {getPageModules} from './route-to-module-mapping-generator';

interface BaseAngularInformation {
  className: string;
}

interface AngularModuleInformation extends BaseAngularInformation {
  type: 'module';
}

interface AngularComponentInformation extends BaseAngularInformation {
  type: 'component';
  selector?: string;
  templateFilePath?: string;
}

interface AngularDirectiveOrPipeInformation extends BaseAngularInformation {
  type: 'directive' | 'pipe';
  selector?: string;
}

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
  'assets/scripts',
  'core/tests/build_sources',
  'core/tests/data',
  'core/tests/load_tests',
  'core/tests/release_sources',
  'core/tests/services_sources',
  'core/tests/test-dependencies',
  'core/templates/tests',
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

const MANUALLY_MAPPED_DEPENDENCIES: Record<string, string[]> = {
  '.lighthouserc-base.js': [
    'puppeteer-login-script.js',
    'core/tests/puppeteer/lighthouse_setup.js',
  ],
  'core/tests/puppeteer-acceptance-tests/puppeteer-testing-utilities/puppeteer-utils.ts':
    ['core/tests/puppeteer-acceptance-tests/spec/helpers/reporter.ts'],
  'core/templates/pages/header_css_libs.html': [
    'core/templates/css/oppia.css',
    'core/templates/css/oppia-material.css',
  ],
  'core/templates/pages/oppia-root/index.ts': [
    'core/templates/pages/oppia-root/oppia-root.mainpage.html',
  ],
  'core/templates/pages/lightweight-oppia-root/index.ts': [
    'core/templates/pages/lightweight-oppia-root/lightweight-oppia-root.mainpage.html',
  ],
  'core/templates/pages/error-pages/error-iframed-page/error-iframed-page.import.ts':
    [
      'core/templates/pages/error-pages/error-iframed-page/error-iframed.mainpage.html',
    ],
};

const VALID_ROOT_FILES: string[] = [
  'AUTHORS',
  'CONTRIBUTORS',
  '.github/CODEOWNERS',
  '.github/CODE_OF_CONDUCT.md',
  '.github/CONTRIBUTING.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/README.md',
  '.github/SECURITY.md',
  '.github/ISSUE_TEMPLATE/4_server_error_template.md',
  '.github/workflows/README.md',
  'assets/README.md',
  'extensions/visualizations/visualizationsRequires.ts',
  'extensions/interactions/interactionsQuestionsRequires.ts',
  'core/templates/AppSpec.ts',
  'extensions/value_generators/valueGeneratorsRequires.ts',
  'extensions/objects/objectComponentsRequires.ts',
  'extensions/objects/objectComponentsRequiresForPlayers.ts',
  'core/templates/domain/exploration/ExplorationMetadataObjectFactorySpec.ts',
  'core/templates/domain/exploration/ExplorationObjectFactorySpec.ts',
  'core/templates/components/concept-card/concept-card-modal.template.html',
  'extensions/rich_text_components/richTextComponentsRequires.ts',
  'core/templates/domain/exploration/LostChangeObjectFactorySpec.ts',
  'core/templates/domain/question/QuestionObjectFactorySpec.ts',
  'core/templates/domain/skill/SkillObjectFactorySpec.ts',
  'core/templates/domain/exploration/StatesObjectFactorySpec.ts',
  'core/templates/domain/state/StateObjectFactorySpec.ts',
  'core/templates/domain/collection/search-explorations-backend-api.service.ts',
  'core/templates/pages/topics-and-skills-dashboard-page/topics-and-skills-dashboard-page.constants.ajs.ts',
  'core/templates/domain/exploration/InteractionObjectFactorySpec.ts',
  'core/templates/domain/exploration/SolutionObjectFactorySpec.ts',
  'core/templates/services/services.constants.ajs.ts',
  'core/README.md',
  'core/templates/karma.module.ts',
  'core/templates/directives/mathjax-bind.directive.ts',
  'core/templates/components/skills-mastery-list/skills-mastery-list-concept-card-modal.controller.ts',
  'core/templates/components/common-layout-directives/common-elements/confirmation-modal.template.html',
  'core/templates/components/common-layout-directives/navigation-bars/side-navigation-bar.component.css',
  'core/templates/components/forms/validators/README.md',
  'core/templates/components/forms/validators/is-float.filter.ts',
  'core/templates/components/question-directives/question-player/question-player.constants.ajs.ts',
  'core/templates/components/question-directives/questions-list/questions-list.constants.ajs.ts',
  'core/templates/components/skills-mastery-list/skills-mastery-list.constants.ajs.ts',
  'core/templates/components/state-editor/state-editor.constants.ajs.ts',
  'core/templates/components/state-editor/state-editor-properties-services/state-written-translations.service.ts',
  'core/templates/components/summary-tile/collection-summary-tile.constants.ajs.ts',
  'core/templates/css/README.md',
  'core/templates/domain/classroom/classroom-domain.constants.ajs.ts',
  'core/templates/domain/collection/collection-domain.constants.ajs.ts',
  'core/templates/domain/exploration/OutcomeObjectFactorySpec.ts',
  'core/templates/domain/exploration/ParamChangeObjectFactorySpec.ts',
  'core/templates/domain/exploration/ParamChangesObjectFactorySpec.ts',
  'core/templates/domain/exploration/ParamSpecObjectFactorySpec.ts',
  'core/templates/domain/exploration/ParamSpecsObjectFactorySpec.ts',
  'core/templates/domain/exploration/ParamTypeObjectFactorySpec.ts',
  'core/templates/domain/exploration/SubtitledUnicodeObjectFactorySpec.ts',
  'core/templates/domain/statistics/learner-answer-details.model.ts',
  'core/templates/domain/exploration/TranslatedContentObjectFactorySpec.ts',
  'core/templates/domain/exploration/WrittenTranslationObjectFactorySpec.ts',
  'core/templates/domain/exploration/WrittenTranslationsObjectFactorySpec.ts',
  'core/templates/domain/feedback_thread/FeedbackThreadObjectFactorySpec.ts',
  'core/templates/domain/objects/NumberWithUnitsObjectFactorySpec.ts',
  'core/templates/domain/objects/UnitsObjectFactorySpec.ts',
  'core/templates/domain/objects/objects-domain.constants.ajs.ts',
  'core/templates/domain/question/question-domain.constants.ajs.ts',
  'core/templates/domain/skill/MisconceptionObjectFactorySpec.ts',
  'core/templates/domain/skill/skill-domain.constants.ajs.ts',
  'core/templates/domain/state/state-version-history.model.ts',
  'core/templates/domain/statistics/statistics-domain.constants.ajs.ts',
  'core/templates/domain/story/story-domain.constants.ajs.ts',
  'core/templates/domain/story_viewer/story-viewer-domain.constants.ajs.ts',
  'core/templates/domain/topic/topic-domain.constants.ajs.ts',
  'core/templates/domain/topic_viewer/topic-viewer-domain.constants.ajs.ts',
  'core/templates/domain/topics_and_skills_dashboard/topics-and-skills-dashboard-domain.constants.ajs.ts',
  'core/templates/domain/utilities/classifier-file.model.ts',
  'core/templates/domain/voiceover/voiceover-domain.constants.ajs.ts',
  'core/templates/filters/string-utility-filters/capitalize.filter.ts',
  'core/templates/filters/string-utility-filters/convert-to-plain-text.filter.ts',
  'core/templates/pages/interaction-specs.constants.ajs.ts',
  'core/templates/pages/about-page/about-page.constants.ajs.ts',
  'core/templates/pages/admin-page/admin-page.constants.ajs.ts',
  'core/templates/pages/contributor-dashboard-admin-page/contributor-dashboard-admin-page.constants.ajs.ts',
  'core/templates/pages/contributor-dashboard-page/contributor-dashboard-page.constants.ajs.ts',
  'core/templates/pages/creator-dashboard-page/creator-dashboard-page.constants.ajs.ts',
  'core/templates/pages/exploration-editor-page/exploration-editor-page.constants.ajs.ts',
  'core/templates/pages/exploration-editor-page/editor-tab/graph-directives/state-graph-visualization.directive.html',
  'core/templates/pages/exploration-editor-page/statistics-tab/templates/playthrough-modal.template.html',
  'core/templates/pages/exploration-player-page/new-lesson-player/README.md',
  'core/templates/pages/exploration-player-page/new-lesson-player/lesson-player-page.constants.ts',
  'core/templates/pages/landing-pages/topic-landing-page/topic-landing-page.constants.ajs.ts',
  'core/templates/pages/learner-dashboard-page/learner-dashboard-page.constants.ajs.ts',
  'core/templates/pages/learner-group-pages/learner-group-pages.constants.ajs.ts',
  'core/templates/pages/practice-session-page/practice-session-page.constants.ajs.ts',
  'core/templates/pages/release-coordinator-page/release-coordinator-page.constants.ajs.ts',
  'core/templates/pages/review-test-page/review-test-page.constants.ajs.ts',
  'core/templates/pages/skill-editor-page/skill-editor-page.constants.ajs.ts',
  'core/templates/pages/story-editor-page/story-editor-page.constants.ajs.ts',
  'core/templates/pages/topic-editor-page/topic-editor-page.constants.ajs.ts',
  'core/templates/services/nested-directives-recursion-timeout-prevention.service.ts',
  'extensions/classifiers/python-program.tokenizer.ts',
  'core/templates/third-party-imports/select2.import.ts',
  'core/tests/karma.conf.ts',
  'core/tests/protractor-browserstack.conf.js',
  'core/tests/wdio.conf.js',
  'data/README.md',
  'data/voiceovers/README.md',
  'extensions/README.md',
  'extensions/ckeditor_plugins/pre/plugin.js',
  'extensions/classifiers/README.md',
  'extensions/classifiers/classifiers-extension.constants.ajs.ts',
  'extensions/classifiers/winnowing-preprocessing.service.ts',
  'extensions/interactions/interactions-extension.constants.ajs.ts',
  'extensions/interactions/AlgebraicExpressionInput/directives/algebraic-expression-input-short-response.component.html',
  'extensions/objects/templates/svg-editor.constants.ajs.ts',
  'extensions/rich_text_components/README.md',
];
const RUN_ALL_TESTS_ROOT_FILES: string[] = [
  'core/templates/pages/oppia-root/index.ts',
  'core/templates/pages/lightweight-oppia-root/index.ts',
  'src/main.ts',
  'src/index.html',
  'src/index.prod.html',
  'src/environments/environment.prod.ts',
  'src/environments/environment.ts',
  'extensions/extensions.module.ts',
  'core/templates/services/ngb-modal.service.ts',
  'core/templates/directives/angular-html-bind.directive.ts',
];

const CI_TEST_SUITES_DIRECTORY = path.resolve(
  ROOT_DIRECTORY,
  'core/tests/ci-test-suites-config'
);

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
        'The module specifier could not be evaluated in the require or import call in' +
          `${callExpression.getText()} at ${sourceFile.getFilePath()}`
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
  for (const decorator of Object.values(AngularDecorators)) {
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
    if (type === 'directive') {
      return {
        type,
        className,
        selector,
      };
    }

    const nameProperty = objectArgument.getProperty('name');
    const name = nameProperty
      ? nameProperty
          .asKindOrThrow(ts.SyntaxKind.PropertyAssignment)
          .getInitializerOrThrow()
          .asKindOrThrow(ts.SyntaxKind.StringLiteral)
          .getLiteralValue()
      : undefined;
    if (type === 'pipe') {
      return {
        type,
        className,
        selector: name,
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
): Record<string, AngularInformation[]> => {
  return files.reduce((acc, file) => {
    if (file.endsWith('.spec.ts')) {
      acc[file] = [];
      return acc;
    }
    const sourceFile = project.addSourceFileAtPath(file);
    const angularInformations =
      getAngularInformationsFromSourceFile(sourceFile);
    acc[file] = angularInformations;
    return acc;
  }, {});
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
  fileToAngularInformations: Record<string, AngularInformation[]>
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
  for (const [dependencyFile, dependencyAngularInformations] of Object.entries(
    fileToAngularInformations
  )) {
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

/**
 * Gets all the load dependencies from a HTML file.
 */
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
  fileToAngularInformations: Record<string, AngularInformation[]>
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
  fileToAngularInformations: Record<string, AngularInformation[]>
): string[] => {
  const sourceFile = project.addSourceFileAtPath(file);
  const dependencies: string[] = [];
  dependencies.push(...getModuleImportsFromSourceFile(sourceFile));

  const angularInformations = fileToAngularInformations[file];
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
  files: string[],
  fileToAngularInformations: Record<string, AngularInformation[]>
): Record<string, string[]> => {
  return files.reduce((acc, file) => {
    acc[file] = MANUALLY_MAPPED_DEPENDENCIES[file] || [];
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const dependencies = getDependenciesFromTypeScriptOrJavaScriptFile(
        file,
        fileToAngularInformations
      );
      acc[file].push(...dependencies);
    } else if (file.endsWith('.html')) {
      const dependencies = getDependenciesFromHtmlFile(
        file,
        fileToAngularInformations
      );
      acc[file].push(...dependencies);
    }
    return acc;
  }, {});
};

/**
 * Class to generate a file to root files mapping of the files given.
 */
class RootFilesMappingGenerator {
  files: string[];
  dependencyMapping: Record<string, string[]>;
  fileToAngularInformations: Record<string, AngularInformation[]>;
  pageModules: string[];
  referenceCache: Record<string, string[]> = {};

  constructor(files: string[]) {
    this.files = files;
    this.fileToAngularInformations =
      getFileToAngularInformationsFromFiles(files);
    this.dependencyMapping = getDependencyMappingFromFiles(
      files,
      this.fileToAngularInformations
    );
    this.pageModules = getPageModules();
  }

  /**
   * Checks if the given file is an Angular module.
   */
  private isFileAngularModule(file: string): boolean {
    const angularInformations = this.fileToAngularInformations[file];
    return angularInformations.some(
      angularInformation => angularInformation.type === 'module'
    );
  }

  /**
   * Checks if a file is a frontend test file.
   */
  private isFrontendTestFile(file: string): boolean {
    return (
      file.endsWith('.spec.ts') && !file.includes('puppeteer-acceptance-tests')
    );
  }

  /**
   * Gets the files that depend on the given dependency.
   */
  private getFilesWithDependency(
    dependency: string,
    ignoreModules: boolean = true
  ): string[] {
    let references: string[] = [];

    if (this.referenceCache[dependency]) {
      references = this.referenceCache[dependency];
    } else {
      references = Object.keys(this.dependencyMapping).filter(file => {
        if (this.isFrontendTestFile(file)) {
          return false;
        }

        const dependencies = this.dependencyMapping[file];
        return dependencies.includes(dependency);
      });
      this.referenceCache[dependency] = references;
    }

    return references.filter((reference: string) => {
      if (ignoreModules) {
        return !this.isFileAngularModule(reference);
      }
      return true;
    });
  }

  /**
   * Finds the root dependencies for the given file.
   */
  private getRootFilesOfFile(
    file: string,
    cache: Record<string, string[]> = {},
    ignoreModules: boolean = true,
    visited: Set<string> = new Set()
  ): string[] {
    if (cache[file]) {
      return cache[file];
    }
    if (visited.has(file)) {
      return [];
    }
    visited.add(file);

    let references = this.getFilesWithDependency(file, ignoreModules);
    if (references.length === 0 || this.pageModules.includes(file)) {
      return [file];
    }

    const roots: string[] = [];
    for (const reference of references) {
      roots.push(
        ...this.getRootFilesOfFile(reference, cache, ignoreModules, visited)
      );
    }

    return Array.from(new Set(roots));
  }

  /**
   * Gets the modules that are part of the CI test suites.
   */
  private getCITestSuiteModules(): string[] {
    const ciTestSuiteModules: string[] = [];
    const ciTestSuiteConfigFiles = fs
      .readdirSync(CI_TEST_SUITES_DIRECTORY)
      .map(file => path.join(CI_TEST_SUITES_DIRECTORY, file));
    for (const ciTestSuiteConfig of ciTestSuiteConfigFiles) {
      const config = JSON.parse(fs.readFileSync(ciTestSuiteConfig, 'utf-8'));
      const suites = config.suites;
      for (const suite of suites) {
        ciTestSuiteModules.push(suite.module);
      }
    }
    return ciTestSuiteModules;
  }

  /**
   * Validates the root files mapping.
   */
  private validateRootFilesMapping(
    rootFilesMapping: Record<string, string[]>
  ): void {
    const rootFiles = Array.from(
      new Set(Object.values(rootFilesMapping).flat())
    );
    const invalidRootFiles = rootFiles.filter((rootFile: string) => {
      if (this.isFrontendTestFile(rootFile)) {
        return false;
      }

      return ![
        ...VALID_ROOT_FILES,
        ...RUN_ALL_TESTS_ROOT_FILES,
        ...this.pageModules,
        ...this.getCITestSuiteModules(),
      ].includes(rootFile);
    });
    if (invalidRootFiles.length > 0) {
      throw new Error(
        'The following invalid root files were found when generating ' +
          `the root files mapping:\n${invalidRootFiles.join('\n')}`
      );
    }
  }

  /**
   * Generates the root files mapping.
   */
  public generateRootFilesMapping(): Record<string, string[]> {
    const rootFilesMapping: Record<string, string[]> = {};

    for (const file of this.files) {
      rootFilesMapping[file] = this.getRootFilesOfFile(file, rootFilesMapping);
    }

    const modulizedRootFilesMapping: Record<string, string[]> = {};
    for (const [file, rootFiles] of Object.entries(rootFilesMapping)) {
      const modulizedRootFiles: string[] = [];
      for (const rootFile of rootFiles) {
        modulizedRootFiles.push(
          ...this.getRootFilesOfFile(rootFile, modulizedRootFilesMapping, false)
        );
      }
      modulizedRootFilesMapping[file] = Array.from(new Set(modulizedRootFiles));
    }

    this.validateRootFilesMapping(modulizedRootFilesMapping);

    return modulizedRootFilesMapping;
  }
}

const files = ts.sys
  .readDirectory(ROOT_DIRECTORY, FILE_EXTENSIONS, FILE_EXCLUSIONS, [])
  .reduce((acc: string[], filePath: string) => {
    acc.push(getRelativePathToRootDirectory(filePath));
    return acc;
  }, []);

const rootFilesMapping = new RootFilesMappingGenerator(
  files
).generateRootFilesMapping();
fs.writeFileSync(
  path.resolve(ROOT_DIRECTORY, 'root-files-mapping.json'),
  JSON.stringify(rootFilesMapping, null, 2)
);
