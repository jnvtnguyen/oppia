"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var typescript_1 = __importDefault(require("typescript"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var cheerio = __importStar(require("cheerio"));
// List of directories to exclude from the search.
var EXCLUSIONS = [
    'node_modules',
    'dist',
    'build',
    'types',
    'typings',
    'local_compiled_js_for_test',
    'third_party',
    'webpack_bundles',
    'scripts',
    '.direnv',
    'backend_prod_files',
    'core/tests/build_sources',
    'core/tests/data',
    'core/tests/load_tests',
    'core/tests/release_sources',
    'core/tests/services_sources',
    'core/tests/webdriverio',
    'core/tests/webdriverio_desktop',
    'core/tests/webdriverio_utils',
    'core/tests/depedency-graph-generator.ts'
];
var WEBPACK_DEFINED_ALIASES = {
    'assets/constants': ['assets/constants.ts'],
    'assets/rich_text_component_definitions': ['assets/rich_text_components_definitions.ts'],
    'assets': ['assets'],
    'core/templates': ['core/templates'],
    'extensions': ['extensions'],
    'third_party': ['third_party']
};
var BUILT_IN_NODE_MODULES = [
    'fs',
    'path',
    'console'
];
var ROOT_DIRECTORY = path_1["default"].resolve(__dirname, '../../');
var resolveExpressionIntoString = function (expression) {
    if (expression.includes('+')) {
        var parts = expression.split('+');
        return parts
            .map(function (part) {
            return part.trim().slice(1, -1);
        })
            .join('');
    }
    return expression.slice(1, -1);
};
var DepedencyExtractor = /** @class */ (function () {
    function DepedencyExtractor(typescriptHost, typescriptConfig, fileAngularInformationsMapping) {
        /*
         * Provided a file path without an extension, it returns the file path with the
         * extension '.ts' or '.js' if it exists.
         */
        this.getFilePathWithExtension = function (path) {
            if (fs_1["default"].existsSync(path + '.ts'))
                return path + '.ts';
            if (fs_1["default"].existsSync(path + '.js'))
                return path + '.js';
            return path;
        };
        this.typescriptHost = typescriptHost;
        this.typescriptConfig = typescriptConfig;
        this.fileAngularInformationsMapping = fileAngularInformationsMapping;
    }
    /**
     * Checks if a file is a lib or not.
     */
    DepedencyExtractor.prototype.isFilePathALib = function (filePath) {
        var rootFilePath = filePath;
        if (filePath.includes('/')) {
            rootFilePath = filePath.substring(0, filePath.indexOf('/'));
        }
        if (BUILT_IN_NODE_MODULES.includes(rootFilePath)) {
            return true;
        }
        ;
        return fs_1["default"].existsSync(path_1["default"].resolve(ROOT_DIRECTORY, 'node_modules', rootFilePath));
    };
    /**
     * Checks if a file path is relative or not.
     */
    DepedencyExtractor.prototype.isFilePathRelative = function (filePath) {
        return filePath.startsWith('.');
    };
    /**
     * Returns the path by alias using the TypeScript config, if it exists.
     */
    DepedencyExtractor.prototype.resolvePathByAlias = function (filePath) {
        var aliases = __assign(__assign({}, this.typescriptConfig.compilerOptions.paths), WEBPACK_DEFINED_ALIASES);
        for (var _i = 0, _a = Object.keys(aliases); _i < _a.length; _i++) {
            var aliasPath = _a[_i];
            var formattedAliasPath = aliasPath.replace('/*', '');
            if (filePath.startsWith(formattedAliasPath)) {
                var fullAliasPath = aliases[aliasPath][0].replace('/*', '');
                return filePath.replace(formattedAliasPath, fullAliasPath);
            }
        }
    };
    /**
     * Resolves a module path to a file path relative to the root directory.
     */
    DepedencyExtractor.prototype.resolveModulePathToFilePath = function (modulePath, relativeFilePath) {
        if (!this.isFilePathRelative(modulePath) && this.isFilePathALib(modulePath)) {
            return;
        }
        var pathByAlias = this.resolvePathByAlias(modulePath);
        if (pathByAlias) {
            return this.getFilePathWithExtension(pathByAlias);
        }
        if (this.isFilePathRelative(modulePath)) {
            return this.getFilePathWithExtension(path_1["default"].join(path_1["default"].dirname(relativeFilePath), modulePath));
        }
        else {
            return this.getFilePathWithExtension(path_1["default"].resolve(ROOT_DIRECTORY, 'core/templates', modulePath)
                .replace(ROOT_DIRECTORY + "/", ''));
        }
    };
    /**
     * Checks if the given file has a module declaration.
     */
    DepedencyExtractor.prototype.doesFileHaveModuleDeclaration = function (filePath) {
        var fileAngularInformations = this.fileAngularInformationsMapping[filePath];
        if (!fileAngularInformations)
            return false;
        return fileAngularInformations.some(function (info) { return info.type === 'module'; });
    };
    /**
     * Extracts the depedencies from the given TypeScript or Javascript file.
     */
    DepedencyExtractor.prototype.extractDepedenciesFromTypescriptOrJavascriptFile = function (filePath) {
        var _this = this;
        var sourceFile = this.typescriptHost.getSourceFile(filePath, typescript_1["default"].ScriptTarget.ES2020);
        if (!sourceFile) {
            throw new Error("Failed to read source file: " + filePath + ".");
        }
        var fileAngularInformations = this.fileAngularInformationsMapping[filePath];
        var fileDepedencies = [];
        sourceFile.forEachChild(function (node) {
            var modulePath;
            if (typescript_1["default"].isImportDeclaration(node)) {
                modulePath = resolveExpressionIntoString(node.moduleSpecifier.getText(sourceFile));
            }
            if (typescript_1["default"].isExpressionStatement(node) &&
                typescript_1["default"].isCallExpression(node.expression)) {
                if (node.expression.expression.getText(sourceFile) !== 'require') {
                    return;
                }
                modulePath = resolveExpressionIntoString(node.expression.arguments[0].getText(sourceFile));
            }
            if (!modulePath)
                return;
            var resolvedModulePath = _this.resolveModulePathToFilePath(modulePath, filePath);
            if (!resolvedModulePath)
                return;
            if (!fs_1["default"].existsSync(path_1["default"].join(ROOT_DIRECTORY, resolvedModulePath))) {
                throw new Error("The module with path: " + resolvedModulePath + ", does not exist, occured at " + filePath + ".");
            }
            if (_this.doesFileHaveModuleDeclaration(filePath) &&
                !_this.doesFileHaveModuleDeclaration(resolvedModulePath)) {
                return;
            }
            fileDepedencies.push(resolvedModulePath);
        });
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
    DepedencyExtractor.prototype.extractDepedenciesFromHTMLFile = function (filePath) {
        var fileContent = fs_1["default"].readFileSync(filePath, 'utf8');
        var document = cheerio.load(fileContent);
        document('*')
            .children()
            .each(function (_, element) {
            for (var _i = 0, _a = Object.entries(element.attribs); _i < _a.length; _i++) {
                var _b = _a[_i], attributeName = _b[0], attributeValue = _b[1];
                if ((attributeName.startsWith('[') && attributeName.endsWith(']')) ||
                    (attributeName.startsWith('(') && attributeName.endsWith(')'))) {
                    document(element).removeAttr(attributeName);
                    document(element).attr(attributeName.slice(1, -1), attributeValue);
                }
            }
        });
        var fileDepedencies = [];
        for (var _i = 0, _a = Object.entries(this.fileAngularInformationsMapping); _i < _a.length; _i++) {
            var _b = _a[_i], searchingFilePath = _b[0], fileAngularInformations = _b[1];
            for (var _c = 0, fileAngularInformations_2 = fileAngularInformations; _c < fileAngularInformations_2.length; _c++) {
                var fileAngularInformation = fileAngularInformations_2[_c];
                if (fileAngularInformation.type === 'component' ||
                    fileAngularInformation.type === 'directive') {
                    var elementIsPresent = document(fileAngularInformation.selector).length > 0;
                    if (!elementIsPresent)
                        continue;
                    fileDepedencies.push(searchingFilePath);
                }
            }
        }
        return Array.from(new Set(fileDepedencies));
    };
    /**
     * Gets the property value by its name from the given expression.
     */
    DepedencyExtractor.prototype.getPropertyValueByNameFromExpression = function (expression, propertyName, sourceFile) {
        if (!typescript_1["default"].isObjectLiteralExpression(expression))
            return;
        for (var _i = 0, _a = expression.properties; _i < _a.length; _i++) {
            var property = _a[_i];
            if (!typescript_1["default"].isPropertyAssignment(property))
                continue;
            if (typescript_1["default"].isIdentifier(property.name) &&
                property.name.getText(sourceFile) === propertyName) {
                return resolveExpressionIntoString(property.initializer.getText(sourceFile));
            }
        }
    };
    /**
     * Extracts the dependencies from the given file path.
     */
    DepedencyExtractor.prototype.extractDepedenciesFromFile = function (filePath) {
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
    DepedencyExtractor.prototype.extractAngularInformationsFromFile = function (filePath) {
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
                    var resolvedTemplateUrl = _this.resolveModulePathToFilePath(templateUrlText, filePath);
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
    return DepedencyExtractor;
}());
var DepedencyGraphGenerator = /** @class */ (function () {
    function DepedencyGraphGenerator(typescriptConfigPath) {
        this.typescriptConfig = this.readTypescriptConfig(typescriptConfigPath);
        this.typescriptHost = typescript_1["default"].createCompilerHost(this.typescriptConfig);
        this.files = this.typescriptHost.readDirectory(ROOT_DIRECTORY, ['.ts', '.js', '.html', '.md'], EXCLUSIONS, []).reduce(function (acc, filePath) {
            acc.push(path_1["default"].relative(ROOT_DIRECTORY, filePath));
            return acc;
        }, []);
    }
    /**
     * Reads the tsconfig file and returns the parsed configuration.
     */
    DepedencyGraphGenerator.prototype.readTypescriptConfig = function (typescriptConfigPath) {
        var typescriptConfig = typescript_1["default"].readConfigFile(typescriptConfigPath, typescript_1["default"].sys.readFile);
        if (typescriptConfig.error) {
            throw new Error("Failed to read TypeScript configuration: " + typescriptConfigPath + ".");
        }
        return typescriptConfig.config;
    };
    /**
     * Gets the angular informations of the files.
     */
    DepedencyGraphGenerator.prototype.getFileAngularInformationsMapping = function () {
        var fileAngularInformationsMapping = {};
        for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
            var filePath = _a[_i];
            var depedencyExtractor = new DepedencyExtractor(this.typescriptHost, this.typescriptConfig, fileAngularInformationsMapping);
            fileAngularInformationsMapping[filePath] =
                depedencyExtractor.extractAngularInformationsFromFile(filePath);
        }
        return fileAngularInformationsMapping;
    };
    /**
     * Generates the depedency graph.
     */
    DepedencyGraphGenerator.prototype.generateDepedencyGraph = function () {
        var fileAngularInformationsMapping = this.getFileAngularInformationsMapping();
        var depedencyExtractor = new DepedencyExtractor(this.typescriptHost, this.typescriptConfig, fileAngularInformationsMapping);
        var depedencyGraph = {};
        for (var _i = 0, _a = this.files; _i < _a.length; _i++) {
            var filePath = _a[_i];
            depedencyGraph[filePath] =
                depedencyExtractor.extractDepedenciesFromFile(filePath);
        }
        return depedencyGraph;
    };
    return DepedencyGraphGenerator;
}());
var depedencyGraphGenerator = new DepedencyGraphGenerator(path_1["default"].resolve(ROOT_DIRECTORY, 'tsconfig.json'));
var depedencyGraph = depedencyGraphGenerator.generateDepedencyGraph();
fs_1["default"].writeFileSync(path_1["default"].resolve(ROOT_DIRECTORY, 'dependency-graph.json'), JSON.stringify(depedencyGraph, null, 2));
