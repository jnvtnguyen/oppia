"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.DependencyGraphGenerator = exports.DependencyExtractor = void 0;
/**
 * @fileoverview Script to generate the dependency graph of the Oppia codebase.
 */
var typescript_1 = __importDefault(require("typescript"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var cheerio = __importStar(require("cheerio"));
var typescript_extractor_utilities_1 = require("./typescript-extractor-utilities");
var ROOT_DIRECTORY = path_1["default"].resolve(__dirname, '../../');
// List of exclusions from the .gitignore file.
var GIT_IGNORE_EXCLUSIONS = fs_1["default"]
    .readFileSync(path_1["default"].resolve(ROOT_DIRECTORY, '.gitignore'), 'utf8')
    .split('\n')
    .filter(function (line) { return line && !line.startsWith('#'); });
// List of directories to exclude from the search.
var SEARCH_EXCLUSIONS = __spreadArrays(GIT_IGNORE_EXCLUSIONS, [
    'types',
    'typings',
    'scripts',
    '.direnv',
    'src',
    'core/tests/build_sources',
    'core/tests/data',
    'core/tests/load_tests',
    'core/tests/release_sources',
    'core/tests/services_sources',
    'core/tests/webdriverio',
    'core/tests/webdriverio_desktop',
    'core/tests/webdriverio_utils',
    'core/tests/puppeteer-acceptance-tests/build',
    'core/tests/depedency-graph-generator.ts',
    'core/tests/test-url-to-angular-module-matcher.ts',
    'core/templates/services/UpgradedServices.ts',
    'core/templates/services/angular-services.index.ts',
    'core/templates/pages/oppia-root/routing/app.routing.module.ts',
    'webpack.common.config.ts',
    'webpack.common.macros.ts',
    'webpack.dev.config.ts',
    'webpack.dev.sourcemap.config.ts',
    'webpack.prod.config.ts',
    'webpack.prod.sourcemap.config.ts',
    'angular-template-style-url-replacer.webpack-loader.js',
]);
// List of file extensions to to include in the search.
var SEARCH_FILE_EXTENSIONS = [
    '.ts',
    '.js',
    '.html',
    '.md',
    '.css',
    'CODEOWNERS',
];
var DependencyExtractor = /** @class */ (function () {
    function DependencyExtractor(typescriptHost, typescriptConfig, fileAngularInformationsMapping) {
        this.typescriptHost = typescriptHost;
        this.typescriptConfig = typescriptConfig;
        this.fileAngularInformationsMapping = fileAngularInformationsMapping;
        this.typescriptExtractorUtilities = new typescript_extractor_utilities_1.TypescriptExtractorUtilities(typescriptConfig);
    }
    /**
     * Extracts the depedencies from the given TypeScript or Javascript file.
     */
    DependencyExtractor.prototype.extractDepedenciesFromTypescriptOrJavascriptFile = function (filePath) {
        var _this = this;
        var sourceFile = this.typescriptHost.getSourceFile(filePath, typescript_1["default"].ScriptTarget.ES2020);
        if (!sourceFile) {
            throw new Error("Failed to read source file: " + filePath + ".");
        }
        var fileAngularInformations = this.fileAngularInformationsMapping[filePath];
        var fileDepedencies = [];
        var visitNode = function (node) {
            typescript_1["default"].forEachChild(node, visitNode);
            var modulePath;
            // If the node is an import statement, we extract the module path.
            if (typescript_1["default"].isImportDeclaration(node)) {
                modulePath =
                    _this.typescriptExtractorUtilities.resolveExpressionIntoString(node.moduleSpecifier.getText(sourceFile));
            }
            // If the node is a require or import function call, we extract the module path.
            if (typescript_1["default"].isCallExpression(node)) {
                if (node.expression.kind !== typescript_1["default"].SyntaxKind.RequireKeyword &&
                    node.expression.kind !== typescript_1["default"].SyntaxKind.ImportKeyword &&
                    node.expression.getText(sourceFile) !== 'require') {
                    return;
                }
                modulePath =
                    _this.typescriptExtractorUtilities.resolveExpressionIntoString(node.arguments[0].getText(sourceFile));
            }
            if (!modulePath)
                return;
            var resolvedModulePath = _this.typescriptExtractorUtilities.resolveModulePathToFilePath(modulePath, filePath);
            if (!resolvedModulePath)
                return;
            if (!fs_1["default"].existsSync(path_1["default"].join(ROOT_DIRECTORY, resolvedModulePath))) {
                throw new Error("The module with path: " + resolvedModulePath + ", does not exist, occured at " + filePath + ".");
            }
            fileDepedencies.push(resolvedModulePath);
        };
        sourceFile.forEachChild(function (node) {
            visitNode(node);
        });
        // We need to add the mainpage file as a depedency if the file is an import file since
        // it is loaded by Webpack.
        if (filePath.endsWith('.import.ts')) {
            var mainpageFilePath = filePath.replace('.import.ts', '.mainpage.html');
            if (fs_1["default"].existsSync(path_1["default"].join(ROOT_DIRECTORY, mainpageFilePath))) {
                fileDepedencies.push(mainpageFilePath);
            }
        }
        for (var _i = 0, fileAngularInformations_1 = fileAngularInformations; _i < fileAngularInformations_1.length; _i++) {
            var fileAngularInformation = fileAngularInformations_1[_i];
            if (fileAngularInformation.type === 'component') {
                fileDepedencies.push(fileAngularInformation.templateUrl);
            }
        }
        return Array.from(new Set(fileDepedencies));
    };
    /**
     * Extracts the depedencies from the given HTML file.
     */
    DependencyExtractor.prototype.extractDepedenciesFromHTMLFile = function (filePath) {
        var _this = this;
        var fileContent = fs_1["default"].readFileSync(filePath, 'utf8');
        var document = cheerio.load(fileContent);
        var fileDepedencies = [];
        document('*')
            .children()
            .each(function (_, element) {
            // Here we replace any Angular binding attributes with regular attributes
            // since we cannot select them when there are brackets or parentheses.
            for (var _i = 0, _a = Object.entries(element.attribs); _i < _a.length; _i++) {
                var _b = _a[_i], attributeName = _b[0], attributeValue = _b[1];
                if ((attributeName.startsWith('[') && attributeName.endsWith(']')) ||
                    (attributeName.startsWith('(') && attributeName.endsWith(')'))) {
                    document(element).removeAttr(attributeName);
                    document(element).attr(attributeName.slice(1, -1), attributeValue);
                }
            }
            // Here we check if the element has a load function.
            var elementText = document(element).text();
            if (elementText.includes('@load')) {
                var loadFunctions = elementText
                    .split('\n')
                    .filter(function (line) { return line.includes('@load'); });
                for (var _c = 0, loadFunctions_1 = loadFunctions; _c < loadFunctions_1.length; _c++) {
                    var loadFunction = loadFunctions_1[_c];
                    var args = loadFunction.substring(loadFunction.indexOf('(') + 1, loadFunction.indexOf(')'));
                    var loadFilePath = _this.typescriptExtractorUtilities.resolveExpressionIntoString(args.split(',')[0]);
                    var resolvedLoadFilePath = _this.typescriptExtractorUtilities.resolveModulePathToFilePath(loadFilePath, filePath);
                    if (resolvedLoadFilePath) {
                        fileDepedencies.push(resolvedLoadFilePath);
                    }
                }
            }
            var elementTag = element.tagName;
            if (elementTag === 'link' || elementTag === 'preload') {
                var elementHref = element.attribs.href;
                if (!elementHref.endsWith('.css')) {
                    return;
                }
                if (!elementHref.startsWith('/templates/css')) {
                    return;
                }
                var fullPath = 'core' + elementHref;
                if (!fs_1["default"].existsSync(path_1["default"].join(ROOT_DIRECTORY, fullPath))) {
                    throw new Error("The CSS file with path: " + fullPath + ", does not exist, occured at " + filePath + ".");
                }
                fileDepedencies.push(fullPath);
            }
        });
        for (var _i = 0, _a = Object.entries(this.fileAngularInformationsMapping); _i < _a.length; _i++) {
            var _b = _a[_i], searchingFilePath = _b[0], fileAngularInformations = _b[1];
            var _loop_1 = function (fileAngularInformation) {
                var depedencyIsPresent = false;
                if (fileAngularInformation.type === 'pipe') {
                    document('*')
                        .children()
                        .each(function (_, element) {
                        var elementText = document(element).text();
                        if (elementText.includes('|') &&
                            elementText.includes(fileAngularInformation.selector)) {
                            depedencyIsPresent = true;
                            return false;
                        }
                        for (var _i = 0, _a = Object.values(element.attribs); _i < _a.length; _i++) {
                            var attributeValue = _a[_i];
                            if (attributeValue.includes('|') &&
                                attributeValue.includes(fileAngularInformation.selector)) {
                                depedencyIsPresent = true;
                                return false;
                            }
                        }
                    });
                }
                else if (fileAngularInformation.type === 'component' ||
                    fileAngularInformation.type === 'directive') {
                    depedencyIsPresent =
                        document(fileAngularInformation.selector).length > 0;
                }
                if (depedencyIsPresent) {
                    fileDepedencies.push(searchingFilePath);
                }
            };
            for (var _c = 0, fileAngularInformations_2 = fileAngularInformations; _c < fileAngularInformations_2.length; _c++) {
                var fileAngularInformation = fileAngularInformations_2[_c];
                _loop_1(fileAngularInformation);
            }
        }
        return Array.from(new Set(fileDepedencies));
    };
    /**
     * Gets the property value by its name from the given expression.
     */
    DependencyExtractor.prototype.getPropertyValueByNameFromExpression = function (expression, propertyName, sourceFile) {
        if (!typescript_1["default"].isObjectLiteralExpression(expression))
            return;
        for (var _i = 0, _a = expression.properties; _i < _a.length; _i++) {
            var property = _a[_i];
            if (!typescript_1["default"].isPropertyAssignment(property))
                continue;
            if (typescript_1["default"].isIdentifier(property.name) &&
                property.name.getText(sourceFile) === propertyName) {
                return this.typescriptExtractorUtilities.resolveExpressionIntoString(property.initializer.getText(sourceFile));
            }
        }
    };
    /**
     * Extracts the dependencies from the given file path.
     */
    DependencyExtractor.prototype.extractDepedenciesFromFile = function (filePath) {
        var fileExtension = path_1["default"].extname(filePath);
        if (fileExtension === '.ts' || fileExtension === '.js') {
            return this.extractDepedenciesFromTypescriptOrJavascriptFile(filePath);
        }
        else if (fileExtension === '.html') {
            return this.extractDepedenciesFromHTMLFile(filePath);
        }
        else {
            return [];
        }
    };
    /**
     * Extracts the Angular informations from the given file path.
     */
    DependencyExtractor.prototype.extractAngularInformationsFromFile = function (filePath) {
        var _this = this;
        var sourceFile = this.typescriptHost.getSourceFile(filePath, typescript_1["default"].ScriptTarget.ES2020);
        if (!sourceFile) {
            throw new Error("Failed to read source file: " + filePath + ".");
        }
        var fileAngularInformations = [];
        sourceFile.forEachChild(function (node) {
            if (!typescript_1["default"].isClassDeclaration(node) || !node.decorators || !node.name)
                return;
            for (var _i = 0, _a = node.decorators; _i < _a.length; _i++) {
                var decorator = _a[_i];
                if (!typescript_1["default"].isCallExpression(decorator.expression))
                    continue;
                var decoratorText = decorator.expression.expression.getText(sourceFile);
                var className = node.name.getText(sourceFile);
                if (decoratorText === 'NgModule') {
                    fileAngularInformations.push({
                        type: 'module',
                        className: className
                    });
                }
                else if (decoratorText === 'Component') {
                    var selectorText = _this.getPropertyValueByNameFromExpression(decorator.expression.arguments[0], 'selector', sourceFile);
                    var templateUrlText = _this.getPropertyValueByNameFromExpression(decorator.expression.arguments[0], 'templateUrl', sourceFile);
                    if (!selectorText || !templateUrlText)
                        continue;
                    var resolvedTemplateUrl = _this.typescriptExtractorUtilities.resolveModulePathToFilePath(templateUrlText, filePath);
                    if (!resolvedTemplateUrl)
                        continue;
                    fileAngularInformations.push({
                        type: 'component',
                        selector: selectorText,
                        templateUrl: resolvedTemplateUrl,
                        className: className
                    });
                }
                else if (decoratorText === 'Directive' || decoratorText === 'Pipe') {
                    var selectorText = _this.getPropertyValueByNameFromExpression(decorator.expression.arguments[0], 'selector', sourceFile);
                    if (!selectorText)
                        continue;
                    fileAngularInformations.push({
                        type: decoratorText === 'Directive' ? 'directive' : 'pipe',
                        selector: selectorText,
                        className: className
                    });
                }
            }
        });
        return fileAngularInformations;
    };
    return DependencyExtractor;
}());
exports.DependencyExtractor = DependencyExtractor;
var DependencyGraphGenerator = /** @class */ (function () {
    function DependencyGraphGenerator() {
        this.dependenciesMapping = {};
        this.dependencyGraph = {};
        var typescriptConfigPath = path_1["default"].resolve(ROOT_DIRECTORY, 'tsconfig.json');
        this.typescriptConfig = typescript_extractor_utilities_1.readTypescriptConfig(typescriptConfigPath);
        this.typescriptHost = typescript_1["default"].createCompilerHost(this.typescriptConfig);
        this.files = this.typescriptHost.readDirectory(ROOT_DIRECTORY, SEARCH_FILE_EXTENSIONS, SEARCH_EXCLUSIONS, []).reduce(function (acc, filePath) {
            if ((filePath.includes('puppeteer-acceptance-tests') ||
                (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js'))) &&
                !filePath.includes('webdriverio.js')) {
                acc.push(path_1["default"].relative(ROOT_DIRECTORY, filePath));
            }
            return acc;
        }, []);
        this.fileAngularInformationsMapping =
            this.getFileAngularInformationsMapping();
    }
    /**
     * Gets the angular informations of the files.
     */
    DependencyGraphGenerator.prototype.getFileAngularInformationsMapping = function () {
        var fileAngularInformationsMapping = {};
        for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
            var filePath = _a[_i];
            var depedencyExtractor = new DependencyExtractor(this.typescriptHost, this.typescriptConfig, fileAngularInformationsMapping);
            fileAngularInformationsMapping[filePath] =
                depedencyExtractor.extractAngularInformationsFromFile(filePath);
        }
        return fileAngularInformationsMapping;
    };
    /**
     * Finds the files with the given depedency.
     */
    DependencyGraphGenerator.prototype.getFilesWithDepedency = function (depedencyFilePath, ignoreModules) {
        var _this = this;
        if (ignoreModules === void 0) { ignoreModules = true; }
        return Object.keys(this.dependenciesMapping).filter(function (key) {
            return _this.dependenciesMapping[key].includes(depedencyFilePath) &&
                (!ignoreModules ||
                    !_this.fileAngularInformationsMapping[key].some(function (information) { return information.type === 'module'; }));
        });
    };
    /**
     * Finds the root depedencies for the given file.
     */
    DependencyGraphGenerator.prototype.getRootDepedenciesForFile = function (filePath, ignoreModules, visited) {
        if (ignoreModules === void 0) { ignoreModules = true; }
        if (visited === void 0) { visited = new Set(); }
        if (visited.has(filePath)) {
            return [];
        }
        visited.add(filePath);
        var references = this.getFilesWithDepedency(filePath, ignoreModules);
        if (references.length === 0 && ignoreModules) {
            ignoreModules = false;
            references = this.getFilesWithDepedency(filePath, ignoreModules);
        }
        if (references.length === 0) {
            return [filePath];
        }
        var rootReferences = [];
        for (var _i = 0, references_1 = references; _i < references_1.length; _i++) {
            var reference = references_1[_i];
            rootReferences.push.apply(rootReferences, this.getRootDepedenciesForFile(reference, ignoreModules, visited));
        }
        return Array.from(new Set(rootReferences));
    };
    /**
     * Generates the depedency graph.
     */
    DependencyGraphGenerator.prototype.generateDepedencyGraph = function () {
        var dependencyExtractor = new DependencyExtractor(this.typescriptHost, this.typescriptConfig, this.fileAngularInformationsMapping);
        for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
            var filePath = _a[_i];
            this.dependenciesMapping[filePath] =
                dependencyExtractor.extractDepedenciesFromFile(filePath);
        }
        fs_1["default"].writeFileSync(path_1["default"].resolve(ROOT_DIRECTORY, 'dependencies-mapping.json'), JSON.stringify(this.dependenciesMapping, null, 2));
        for (var _b = 0, _c = this.files; _b < _c.length; _b++) {
            var filePath = _c[_b];
            this.dependencyGraph[filePath] = this.getRootDepedenciesForFile(filePath);
        }
        return this.dependencyGraph;
    };
    return DependencyGraphGenerator;
}());
exports.DependencyGraphGenerator = DependencyGraphGenerator;
var dependencyGraphGenerator = new DependencyGraphGenerator();
var dependencyGraph = dependencyGraphGenerator.generateDepedencyGraph();
fs_1["default"].writeFileSync(path_1["default"].resolve(ROOT_DIRECTORY, 'dependency-graph.json'), JSON.stringify(dependencyGraph, null, 2));
