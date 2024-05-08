"use strict";
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
    '.direnv'
];
var ROOT = path_1["default"].resolve(__dirname, '../../');
var fileAngularInformationsMapping = {};
var fileDepedenciesMapping = {};
/*
 * Reads the tsconfig file and returns the parsed JSON.
 */
var readTSConfig = function (tsConfigPath) {
    var tsConfig = typescript_1["default"].readConfigFile(tsConfigPath, typescript_1["default"].sys.readFile);
    if (tsConfig.error) {
        throw tsConfig.error;
    }
    return tsConfig.config;
};
/*
 * Returns the relative path to the root directory.
 */
var getRelativePathToRoot = function (filePath) {
    return path_1["default"].relative(ROOT, filePath);
};
/*
 * Returns the path by alias using the tsconfig file, if it exists.
 */
var getPathByAlias = function (path) {
    for (var _i = 0, _a = Object.keys(tsConfig.compilerOptions.paths); _i < _a.length; _i++) {
        var alias = _a[_i];
        var formattedAlias = alias.replace('/*', '');
        if (path.startsWith(formattedAlias)) {
            var fullAliasPath = tsConfig.compilerOptions.paths[alias][0].replace('/*', '');
            return path.replace(formattedAlias, fullAliasPath);
        }
    }
    return undefined;
};
/*
 * Provided a file path without an extension, it returns the file path with the
 * extension '.ts' or '.js' if it exists.
 */
var getFileWithExtensionByPathWithoutExtension = function (path) {
    if (fs_1["default"].existsSync(path + '.ts'))
        return path + '.ts';
    if (fs_1["default"].existsSync(path + '.js'))
        return path + '.js';
    return path;
};
/*
 * Resolves any import path to the root directory.
 */
var resolveGenericImportPathToRoot = function (importPath, relativeFile) {
    if (fs_1["default"].existsSync(path_1["default"].resolve(ROOT, 'node_modules', importPath.substring(0, importPath.indexOf('/')))))
        return;
    var pathByAlias = getPathByAlias(importPath);
    if (pathByAlias) {
        return getFileWithExtensionByPathWithoutExtension(pathByAlias);
    }
    return getFileWithExtensionByPathWithoutExtension(path_1["default"].join(path_1["default"].dirname(relativeFile), importPath));
};
/**
 * Finds the file depedency that corresponds to the given selector.
 */
var findSelectorDepedency = function (selector) {
    for (var _i = 0, _a = Object.keys(fileAngularInformationsMapping); _i < _a.length; _i++) {
        var filePath = _a[_i];
        var fileAngularInformation = fileAngularInformationsMapping[filePath];
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
var findAttributesDepedencies = function (attributes) {
    var depedencies = [];
    for (var _i = 0, _a = Object.keys(attributes); _i < _a.length; _i++) {
        var attribute = _a[_i];
        var attributeValue = attributes[attribute];
        if (attribute.startsWith('[') && attribute.endsWith(']')) {
            var selectorDepedency = findSelectorDepedency(attributeValue);
            if (selectorDepedency) {
                depedencies.push(selectorDepedency);
            }
        }
    }
    return depedencies;
};
/**
 * Finds the pipe depedency that corresponds to the given expression.
 */
var findPipeDepedency = function (expression) {
    if (!expression.includes('|'))
        return;
    var pipeFunction = expression.split('|')[1].split(':')[0].trim();
    for (var _i = 0, _a = Object.keys(fileAngularInformationsMapping); _i < _a.length; _i++) {
        var filePath = _a[_i];
        var fileAngularInformation = fileAngularInformationsMapping[filePath];
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
 * Gets the file path by the class name if it exists.
 */
var getFileByClassName = function (className) {
    for (var _i = 0, _a = Object.keys(fileAngularInformationsMapping); _i < _a.length; _i++) {
        var filePath = _a[_i];
        for (var _b = 0, _c = fileAngularInformationsMapping[filePath]; _b < _c.length; _b++) {
            var angularInformation = _c[_b];
            if (angularInformation.type != 'none' &&
                angularInformation["class"] === className) {
                return filePath;
            }
        }
    }
};
/**
 * Resolves a expression into a raw string.
 */
var resolveExpressionIntoString = function (expression) {
    if (expression.includes('+')) {
        var parts = expression.split('+');
        return parts.map(function (part) {
            return part.trim().slice(1, -1);
        }).join('');
    }
    if (expression.startsWith("'") && expression.endsWith("'")) {
        return expression.slice(1, -1);
    }
    return expression;
};
var tsConfig = readTSConfig(path_1["default"].join(ROOT, 'tsconfig.json'));
var tsHost = typescript_1["default"].createCompilerHost(tsConfig);
var javascriptAndTypescriptFiles = tsHost.readDirectory(ROOT, ['.ts', '.js'], EXCLUSIONS, []).reduce(function (acc, filePath) {
    if (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js')) {
        acc.push(getRelativePathToRoot(filePath));
    }
    return acc;
}, []);
var htmlFiles = tsHost.readDirectory(ROOT, ['.html'], EXCLUSIONS, []).reduce(function (acc, filePath) {
    acc.push(getRelativePathToRoot(filePath));
    return acc;
}, []);
var _loop_1 = function (filePath) {
    var sourceFile = tsHost.getSourceFile(filePath, typescript_1["default"].ScriptTarget.ES2020);
    if (!sourceFile)
        return "continue";
    fileAngularInformationsMapping[filePath] = [];
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
                fileAngularInformationsMapping[filePath].push({
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
            else if (decoratorText === 'Component' || decoratorText === 'Directive') {
                var selectorText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'selector') || '';
                var templateUrlText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'templateUrl') || '';
                fileAngularInformationsMapping[filePath].push({
                    type: decoratorText.toLowerCase(),
                    selector: resolveExpressionIntoString(selectorText),
                    "class": className,
                    templateUrl: resolveExpressionIntoString(templateUrlText)
                });
            }
            else if (decoratorText === 'Pipe') {
                var selectorText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'name') || '';
                fileAngularInformationsMapping[filePath].push({
                    type: 'pipe',
                    selector: resolveExpressionIntoString(selectorText),
                    "class": className
                });
            }
        }
    });
    // If the file doesn't have any Angular information, we add a 'none' type.
    if (!fileAngularInformationsMapping[filePath].length) {
        fileAngularInformationsMapping[filePath].push({ type: 'none' });
    }
};
// Here we scrape all of the Angular information from the Typescript/JavaScript files.
for (var _i = 0, javascriptAndTypescriptFiles_1 = javascriptAndTypescriptFiles; _i < javascriptAndTypescriptFiles_1.length; _i++) {
    var filePath = javascriptAndTypescriptFiles_1[_i];
    _loop_1(filePath);
}
var _loop_2 = function (filePath) {
    var sourceFile = tsHost.getSourceFile(filePath, typescript_1["default"].ScriptTarget.ES2020);
    if (!sourceFile)
        return "continue";
    var fileDepedencies = [];
    var fileAngularInformation = fileAngularInformationsMapping[filePath];
    // If the file is a module, we need to add the components that are entryComponents as depedencies
    // and ignore the rest of the imports.
    if (fileAngularInformation[0].type === 'module') {
        for (var _i = 0, _a = fileAngularInformation[0].entryComponents; _i < _a.length; _i++) {
            var entryComponent = _a[_i];
            var entryComponentFilePath = getFileByClassName(entryComponent);
            if (entryComponentFilePath) {
                fileDepedencies.push(entryComponentFilePath);
            }
        }
    }
    else {
        sourceFile.forEachChild(function (node) {
            if (typescript_1["default"].isImportDeclaration(node)) {
                var moduleSpecifier = node.moduleSpecifier.getText(sourceFile);
                var resolvedImportPath = resolveGenericImportPathToRoot(resolveExpressionIntoString(moduleSpecifier), filePath);
                if (resolvedImportPath) {
                    fileDepedencies.push(resolvedImportPath);
                }
            }
            if (typescript_1["default"].isExpressionStatement(node)) {
                if (!typescript_1["default"].isCallExpression(node.expression))
                    return;
                if (node.expression.expression.getText(sourceFile) !== 'require')
                    return;
                var importArgument = node.expression.arguments[0].getText(sourceFile);
                var resolvedImportPath = resolveGenericImportPathToRoot(resolveExpressionIntoString(importArgument), filePath);
                if (filePath === 'core/templates/pages/contributor-dashboard-admin-page/contributor-dashboard-admin-page.import.ts') {
                    console.log(importArgument);
                    console.log(resolveExpressionIntoString(importArgument));
                }
                if (resolvedImportPath) {
                    fileDepedencies.push(resolvedImportPath);
                }
            }
        });
    }
    // If the file is a component or directive and has a templateUrl, we need to add it as a depedency.
    for (var _b = 0, fileAngularInformation_3 = fileAngularInformation; _b < fileAngularInformation_3.length; _b++) {
        var angularInformation = fileAngularInformation_3[_b];
        if ((angularInformation.type === 'component' || angularInformation.type === 'directive') &&
            angularInformation.templateUrl) {
            var resolvedTemplateUrlFilePath = resolveGenericImportPathToRoot(angularInformation.templateUrl, filePath);
            if (resolvedTemplateUrlFilePath) {
                fileDepedencies.push(resolvedTemplateUrlFilePath);
            }
        }
    }
    fileDepedenciesMapping[filePath] = fileDepedencies;
};
// Here we scrape all of the dependencies from the Typescript/JavaScript files.
for (var _a = 0, _b = Object.keys(fileAngularInformationsMapping); _a < _b.length; _a++) {
    var filePath = _b[_a];
    _loop_2(filePath);
}
var _loop_3 = function (filePath) {
    var fileDepedencies = [];
    var fileContent = fs_1["default"].readFileSync(filePath, 'utf8');
    var htmlParser = new htmlparser2_1.Parser({
        onopentag: function (name, attributes) {
            var selectorDepedency = findSelectorDepedency(name);
            if (selectorDepedency) {
                fileDepedencies.push(selectorDepedency);
            }
            var attributesDepedencies = findAttributesDepedencies(attributes);
            if (attributesDepedencies) {
                fileDepedencies.push.apply(fileDepedencies, attributesDepedencies);
            }
            for (var _i = 0, _a = Object.values(attributes); _i < _a.length; _i++) {
                var attributeValue = _a[_i];
                var pipeDepedency = findPipeDepedency(attributeValue);
                if (pipeDepedency) {
                    fileDepedencies.push(pipeDepedency);
                }
            }
        },
        ontext: function (text) {
            var pipeDepedency = findPipeDepedency(text);
            if (pipeDepedency) {
                fileDepedencies.push(pipeDepedency);
            }
            if (text.includes('@load')) {
                var loadFunctions = text.split('\n').filter(function (line) { return line.includes('@load'); });
                for (var _i = 0, loadFunctions_1 = loadFunctions; _i < loadFunctions_1.length; _i++) {
                    var loadFunction = loadFunctions_1[_i];
                    var args = loadFunction.substring(loadFunction.indexOf('(') + 1, loadFunction.indexOf(')'));
                    var loadPath = resolveExpressionIntoString(args.split(',')[0]);
                    var resolvedLoadPath = resolveGenericImportPathToRoot(loadPath, filePath);
                    if (resolvedLoadPath) {
                        fileDepedencies.push(resolvedLoadPath);
                    }
                }
            }
        }
    });
    htmlParser.write(fileContent);
    htmlParser.end();
    fileDepedencies[filePath] = fileDepedencies;
};
// Here we scrape all of the dependencies from the HTML files.
for (var _c = 0, htmlFiles_1 = htmlFiles; _c < htmlFiles_1.length; _c++) {
    var filePath = htmlFiles_1[_c];
    _loop_3(filePath);
}
fs_1["default"].writeFileSync(path_1["default"].join(ROOT, 'dependency-graph.json'), JSON.stringify(fileDepedenciesMapping, null, 2));
