"use strict";
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
var typescript_1 = __importDefault(require("typescript"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var htmlparser2_1 = require("htmlparser2");
// List of directories to exclude from the search.
var EXCLUSIONS = [
    'node_modules',
    'dist',
    'build',
    'types',
    'typings',
    'local_compiled_js_for_test',
    'third_party',
    'core/tests',
    'webpack_bundles',
    'scripts',
    '.direnv',
];
var ROOT = path_1["default"].resolve(__dirname, '../../');
/**
 * Resolves a expression into a raw string.
 */
var resolveExpressionIntoString = function (expression) {
    if (expression.includes('+')) {
        var parts = expression.split('+');
        return parts
            .map(function (part) {
            return part.trim().slice(1, -1);
        })
            .join('');
    }
    if (expression.startsWith("'") && expression.endsWith("'")) {
        return expression.slice(1, -1);
    }
    return expression;
};
var DepedencyExtractor = /** @class */ (function () {
    function DepedencyExtractor(filePath, angularInformationMapping, tsHost, tsConfig) {
        var _this = this;
        /*
         * Returns the path by alias using the tsconfig file, if it exists.
         */
        this.getPathByAlias = function (path) {
            for (var _i = 0, _a = Object.keys(_this.tsConfig.compilerOptions.paths); _i < _a.length; _i++) {
                var alias = _a[_i];
                var formattedAlias = alias.replace('/*', '');
                if (path.startsWith(formattedAlias)) {
                    var fullAliasPath = _this.tsConfig.compilerOptions.paths[alias][0].replace('/*', '');
                    return path.replace(formattedAlias, fullAliasPath);
                }
            }
            return undefined;
        };
        /*
         * Provided a file path without an extension, it returns the file path with the
         * extension '.ts' or '.js' if it exists.
         */
        this.getFileWithExtensionByPathWithoutExtension = function (path) {
            if (fs_1["default"].existsSync(path + '.ts'))
                return path + '.ts';
            if (fs_1["default"].existsSync(path + '.js'))
                return path + '.js';
            return path;
        };
        this.filePath = filePath;
        this.fileType = this.filePath.split('.').pop();
        this.angularInformationMapping = angularInformationMapping;
        this.tsHost = tsHost;
        this.tsConfig = tsConfig;
    }
    /**
     * Resolves any import path to the root directory.
     */
    DepedencyExtractor.prototype.resolveGenericImportPathToRoot = function (importPath, relativeFile) {
        if (!importPath.startsWith('.') &&
            fs_1["default"].existsSync(path_1["default"].resolve(ROOT, 'node_modules', importPath.substring(0, importPath.indexOf('/')))))
            return;
        var pathByAlias = this.getPathByAlias(importPath);
        if (pathByAlias) {
            return this.getFileWithExtensionByPathWithoutExtension(pathByAlias);
        }
        return this.getFileWithExtensionByPathWithoutExtension(path_1["default"].join(path_1["default"].dirname(relativeFile), importPath));
    };
    /**
     * Finds the file depedency by the given selector.
     */
    DepedencyExtractor.prototype.findSelectorDepedency = function (selector) {
        for (var _i = 0, _a = Object.keys(this.angularInformationMapping); _i < _a.length; _i++) {
            var filePath = _a[_i];
            var fileAngularInformation = this.angularInformationMapping[filePath];
            for (var _b = 0, fileAngularInformation_1 = fileAngularInformation; _b < fileAngularInformation_1.length; _b++) {
                var angularInformation = fileAngularInformation_1[_b];
                if ((angularInformation.type === 'component' ||
                    angularInformation.type === 'directive') &&
                    angularInformation.selector === selector) {
                    return filePath;
                }
            }
        }
    };
    /**
     * Finds the file depedencies that corresponds to the given attributes.
     */
    DepedencyExtractor.prototype.findAttributesDepedencies = function (attributes) {
        var depedencies = [];
        for (var _i = 0, _a = Object.keys(attributes); _i < _a.length; _i++) {
            var attribute = _a[_i];
            var selectorDepedency = this.findSelectorDepedency(attribute);
            if (selectorDepedency) {
                depedencies.push(selectorDepedency);
            }
        }
        return depedencies;
    };
    /**
     * Finds the pipe depedency that corresponds to the given expression.
     */
    DepedencyExtractor.prototype.findPipeDepedency = function (expression) {
        if (!expression.includes('|'))
            return;
        var pipeFunction = expression.split('|')[1].split(':')[0].trim();
        for (var _i = 0, _a = Object.keys(this.angularInformationMapping); _i < _a.length; _i++) {
            var filePath = _a[_i];
            var fileAngularInformation = this.angularInformationMapping[filePath];
            for (var _b = 0, fileAngularInformation_2 = fileAngularInformation; _b < fileAngularInformation_2.length; _b++) {
                var angularInformation = fileAngularInformation_2[_b];
                if (angularInformation.type === 'pipe' &&
                    angularInformation.selector === pipeFunction) {
                    return filePath;
                }
            }
        }
    };
    /**
     * Gets the file path by its class name if it exists.
     */
    DepedencyExtractor.prototype.getFileByClassName = function (className) {
        for (var _i = 0, _a = Object.keys(this.angularInformationMapping); _i < _a.length; _i++) {
            var filePath = _a[_i];
            for (var _b = 0, _c = this.angularInformationMapping[filePath]; _b < _c.length; _b++) {
                var angularInformation = _c[_b];
                if (angularInformation.type != 'none' &&
                    angularInformation["class"] === className) {
                    return filePath;
                }
            }
        }
    };
    /**
     * Extracts the depedencies from the file.
     */
    DepedencyExtractor.prototype.extractDepedencies = function () {
        var _this = this;
        var fileDepedencies = [];
        if (this.fileType === 'ts' || this.fileType === 'js') {
            var sourceFile_1 = this.tsHost.getSourceFile(this.filePath, typescript_1["default"].ScriptTarget.ES2020);
            if (!sourceFile_1)
                return [];
            var angularInformations = this.angularInformationMapping[this.filePath];
            // If the file is a module, we need to add the components that are entryComponents as depedencies
            // and ignore the rest of the imports.
            if (angularInformations[0].type === 'module') {
                for (var _i = 0, _a = angularInformations[0]
                    .entryComponents; _i < _a.length; _i++) {
                    var entryComponent = _a[_i];
                    var entryComponentFilePath = this.getFileByClassName(entryComponent);
                    if (entryComponentFilePath) {
                        fileDepedencies.push(entryComponentFilePath);
                    }
                }
            }
            else {
                sourceFile_1.forEachChild(function (node) {
                    if (typescript_1["default"].isImportDeclaration(node)) {
                        var moduleSpecifier = node.moduleSpecifier.getText(sourceFile_1);
                        var resolvedImportPath = _this.resolveGenericImportPathToRoot(resolveExpressionIntoString(moduleSpecifier), _this.filePath);
                        if (resolvedImportPath) {
                            fileDepedencies.push(resolvedImportPath);
                        }
                    }
                    if (typescript_1["default"].isExpressionStatement(node)) {
                        if (!typescript_1["default"].isCallExpression(node.expression))
                            return;
                        if (node.expression.expression.getText(sourceFile_1) !== 'require')
                            return;
                        var importArgument = node.expression.arguments[0].getText(sourceFile_1);
                        var resolvedImportPath = _this.resolveGenericImportPathToRoot(resolveExpressionIntoString(importArgument), _this.filePath);
                        if (resolvedImportPath) {
                            fileDepedencies.push(resolvedImportPath);
                        }
                    }
                });
            }
            // If the file is a component or directive and has a templateUrl, we need to add it as a depedency.
            for (var _b = 0, angularInformations_1 = angularInformations; _b < angularInformations_1.length; _b++) {
                var angularInformation = angularInformations_1[_b];
                if ((angularInformation.type === 'component' ||
                    angularInformation.type === 'directive') &&
                    angularInformation.templateUrl) {
                    var resolvedTemplateUrlFilePath = this.resolveGenericImportPathToRoot(angularInformation.templateUrl, this.filePath);
                    if (resolvedTemplateUrlFilePath) {
                        fileDepedencies.push(resolvedTemplateUrlFilePath);
                    }
                }
            }
            return fileDepedencies;
        }
        else if (this.fileType === 'html') {
            var fileContent = fs_1["default"].readFileSync(this.filePath, 'utf8');
            var that_1 = this;
            var htmlParser = new htmlparser2_1.Parser({
                onopentag: function (name, attributes) {
                    var selectorDepedency = that_1.findSelectorDepedency(name);
                    if (selectorDepedency) {
                        fileDepedencies.push(selectorDepedency);
                    }
                    var attributesDepedencies = that_1.findAttributesDepedencies(attributes);
                    if (attributesDepedencies) {
                        fileDepedencies.push.apply(fileDepedencies, attributesDepedencies);
                    }
                    for (var _i = 0, _a = Object.values(attributes); _i < _a.length; _i++) {
                        var attributeValue = _a[_i];
                        var pipeDepedency = that_1.findPipeDepedency(attributeValue);
                        if (pipeDepedency) {
                            fileDepedencies.push(pipeDepedency);
                        }
                    }
                },
                ontext: function (text) {
                    var pipeDepedency = that_1.findPipeDepedency(text);
                    if (pipeDepedency) {
                        fileDepedencies.push(pipeDepedency);
                    }
                    if (text.includes('@load')) {
                        var loadFunctions = text
                            .split('\n')
                            .filter(function (line) { return line.includes('@load'); });
                        for (var _i = 0, loadFunctions_1 = loadFunctions; _i < loadFunctions_1.length; _i++) {
                            var loadFunction = loadFunctions_1[_i];
                            var args = loadFunction.substring(loadFunction.indexOf('(') + 1, loadFunction.indexOf(')'));
                            var loadPath = resolveExpressionIntoString(args.split(',')[0]);
                            var resolvedLoadPath = that_1.resolveGenericImportPathToRoot(loadPath, this.filePath);
                            if (resolvedLoadPath) {
                                fileDepedencies.push(resolvedLoadPath);
                            }
                        }
                    }
                }
            });
            htmlParser.write(fileContent);
            htmlParser.end();
        }
        return Array.from(new Set(fileDepedencies));
    };
    return DepedencyExtractor;
}());
var DepedencyGraphGenerator = /** @class */ (function () {
    function DepedencyGraphGenerator(tsConfigPath) {
        var _this = this;
        /**
         * Reads the tsconfig file and returns the parsed JSON.
         */
        this.readTSConfig = function (tsConfigPath) {
            var tsConfig = typescript_1["default"].readConfigFile(tsConfigPath, typescript_1["default"].sys.readFile);
            if (tsConfig.error) {
                throw tsConfig.error;
            }
            return tsConfig.config;
        };
        /*
         * Returns the relative path to the root directory.
         */
        this.getRelativePathToRoot = function (filePath) {
            return path_1["default"].relative(ROOT, filePath);
        };
        this.tsConfig = this.readTSConfig(tsConfigPath);
        this.tsHost = typescript_1["default"].createCompilerHost(this.tsConfig);
        this.javascriptAndTypescriptFiles = this.tsHost.readDirectory(ROOT, ['.ts', '.js'], EXCLUSIONS, []).reduce(function (acc, filePath) {
            if (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js')) {
                acc.push(_this.getRelativePathToRoot(filePath));
            }
            return acc;
        }, []);
        this.htmlFiles = this.tsHost.readDirectory(ROOT, ['.html'], EXCLUSIONS, []).reduce(function (acc, filePath) {
            acc.push(_this.getRelativePathToRoot(filePath));
            return acc;
        }, []);
    }
    /**
     * Gets the angular information of the files.
     */
    DepedencyGraphGenerator.prototype.getAngularInformationMapping = function () {
        var angularInformationMapping = {};
        var _loop_1 = function (filePath) {
            var sourceFile = this_1.tsHost.getSourceFile(filePath, typescript_1["default"].ScriptTarget.ES2020);
            if (!sourceFile)
                return "continue";
            angularInformationMapping[filePath] = [];
            sourceFile.forEachChild(function (node) {
                var _a;
                if (!typescript_1["default"].isClassDeclaration(node)) {
                    return;
                }
                if (!node.decorators) {
                    return;
                }
                for (var _i = 0, _b = node.decorators; _i < _b.length; _i++) {
                    var decorator = _b[_i];
                    if (!typescript_1["default"].isCallExpression(decorator.expression)) {
                        return;
                    }
                    var decoratorText = decorator.expression.expression.getText(sourceFile);
                    if (!(decoratorText === 'Component' ||
                        decoratorText === 'Directive' ||
                        decoratorText === 'NgModule' ||
                        decoratorText === 'Pipe')) {
                        return;
                    }
                    var getPropertyInArgumentByText = function (arg, prop) {
                        if (typescript_1["default"].isObjectLiteralExpression(arg)) {
                            for (var _i = 0, _a = arg.properties; _i < _a.length; _i++) {
                                var property = _a[_i];
                                if (typescript_1["default"].isPropertyAssignment(property) &&
                                    property.name.getText(sourceFile) === prop) {
                                    return property.initializer.getText(sourceFile);
                                }
                            }
                        }
                    };
                    var className = ((_a = node.name) === null || _a === void 0 ? void 0 : _a.getText(sourceFile)) || '';
                    if (decoratorText === 'NgModule') {
                        var entryComponentsText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'entryComponents');
                        angularInformationMapping[filePath].push({
                            type: 'module',
                            entryComponents: entryComponentsText
                                ? entryComponentsText
                                    .slice(1, -1)
                                    .split(',')
                                    .map(function (entryComponent) { return entryComponent.trim(); })
                                    .filter(function (entryComponent) { return entryComponent !== ''; })
                                : [],
                            "class": className
                        });
                    }
                    else if (decoratorText === 'Component' ||
                        decoratorText === 'Directive') {
                        var selectorText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'selector');
                        var templateUrlText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'templateUrl');
                        angularInformationMapping[filePath].push({
                            type: decoratorText.toLowerCase(),
                            selector: selectorText && resolveExpressionIntoString(selectorText),
                            "class": className,
                            templateUrl: templateUrlText && resolveExpressionIntoString(templateUrlText)
                        });
                    }
                    else if (decoratorText === 'Pipe') {
                        var selectorText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'name');
                        angularInformationMapping[filePath].push({
                            type: 'pipe',
                            selector: selectorText && resolveExpressionIntoString(selectorText),
                            "class": className
                        });
                    }
                }
            });
            // If the file doesn't have any Angular information, we add a 'none' type.
            if (!angularInformationMapping[filePath].length) {
                angularInformationMapping[filePath].push({ type: 'none' });
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = this.javascriptAndTypescriptFiles; _i < _a.length; _i++) {
            var filePath = _a[_i];
            _loop_1(filePath);
        }
        return angularInformationMapping;
    };
    /**
     * Generates the file depedencies mapping.
     */
    DepedencyGraphGenerator.prototype.generateFileDepedenciesMapping = function (angularInformationMapping) {
        var allFiles = __spreadArrays(this.javascriptAndTypescriptFiles, this.htmlFiles);
        var fileDepedenciesMapping = {};
        for (var _i = 0, allFiles_1 = allFiles; _i < allFiles_1.length; _i++) {
            var filePath = allFiles_1[_i];
            var depedencyExtractor = new DepedencyExtractor(filePath, angularInformationMapping, this.tsHost, this.tsConfig);
            fileDepedenciesMapping[filePath] =
                depedencyExtractor.extractDepedencies();
        }
        return fileDepedenciesMapping;
    };
    /**
     * Generates the depedency graph.
     */
    DepedencyGraphGenerator.prototype.generateDepedencyGraph = function (generateFile) {
        if (generateFile === void 0) { generateFile = true; }
        var angularInformationMapping = this.getAngularInformationMapping();
        var fileDepedenciesMapping = this.generateFileDepedenciesMapping(angularInformationMapping);
        fs_1["default"].writeFileSync(path_1["default"].join(ROOT, 'dependency-graph.json'), JSON.stringify(fileDepedenciesMapping, null, 2));
        return {};
    };
    return DepedencyGraphGenerator;
}());
new DepedencyGraphGenerator(path_1["default"].resolve(ROOT, 'tsconfig.json')).generateDepedencyGraph();
