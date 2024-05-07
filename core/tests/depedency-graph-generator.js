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
 * Returns the path by alias using the tsconfig file.
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
var getFileWithExtensionByPath = function (path) {
    if (fs_1["default"].existsSync(path + '.ts'))
        return path + '.ts';
    if (fs_1["default"].existsSync(path + '.js'))
        return path + '.js';
    return path;
};
/*
 * Resolves any import path to the root directory.
 */
var resolveImportPathToRoot = function (importPath, relativeFile) {
    if (importPath.startsWith('.') && relativeFile) {
        return getFileWithExtensionByPath(getRelativePathToRoot(path_1["default"].resolve(path_1["default"].dirname(relativeFile), importPath)));
    }
    else {
        var pathByAlias = getPathByAlias(importPath);
        if (pathByAlias) {
            return getFileWithExtensionByPath(pathByAlias);
        }
    }
};
/**
 * Finds the file depedency that corresponds to the given selector.
 */
var findSelectorDepedency = function (selector) {
    for (var _i = 0, _a = Object.keys(preSweepFilesInformations); _i < _a.length; _i++) {
        var file = _a[_i];
        var preSweepFileInformations = preSweepFilesInformations[file];
        for (var _b = 0, preSweepFileInformations_1 = preSweepFileInformations; _b < preSweepFileInformations_1.length; _b++) {
            var preSweepFileInformation = preSweepFileInformations_1[_b];
            if (preSweepFileInformation.type === 'component' &&
                preSweepFileInformation.selector === selector) {
                return file;
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
    for (var _i = 0, _a = Object.keys(preSweepFilesInformations); _i < _a.length; _i++) {
        var file = _a[_i];
        var preSweepFileInformations = preSweepFilesInformations[file];
        for (var _b = 0, preSweepFileInformations_2 = preSweepFileInformations; _b < preSweepFileInformations_2.length; _b++) {
            var preSweepFileInformation = preSweepFileInformations_2[_b];
            if (preSweepFileInformation.type === 'pipe' &&
                preSweepFileInformation.selector === pipeFunction) {
                return file;
            }
        }
    }
};
var tsConfigPath = path_1["default"].join(ROOT, 'tsconfig.json');
var tsConfig = readTSConfig(tsConfigPath);
var host = typescript_1["default"].createCompilerHost(tsConfig);
var javascriptAndTypescriptFiles = host.readDirectory(ROOT, ['.ts', '.js'], EXCLUSIONS, []).reduce(function (acc, file) {
    if (!file.endsWith('.spec.ts') && !file.endsWith('.spec.js')) {
        acc.push(getRelativePathToRoot(file));
    }
    return acc;
}, []);
var htmlFiles = host.readDirectory(ROOT, ['.html'], EXCLUSIONS, []).reduce(function (acc, file) {
    acc.push(getRelativePathToRoot(file));
    return acc;
}, []);
var preSweepFilesInformations = {};
var _loop_1 = function (file) {
    var sourceFile = host.getSourceFile(file, typescript_1["default"].ScriptTarget.ES2020);
    if (!sourceFile)
        return "continue";
    preSweepFilesInformations[file] = [];
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
                preSweepFilesInformations[file].push({
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
                var selectorText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'selector');
                var templateUrlText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'templateUrl');
                preSweepFilesInformations[file].push({
                    type: decoratorText.toLowerCase(),
                    selector: selectorText ? selectorText.slice(1, -1) : '',
                    "class": className,
                    templateUrl: templateUrlText ? templateUrlText.slice(1, -1) : ''
                });
            }
            else if (decoratorText === 'Pipe') {
                var selectorText = getPropertyInArgumentByText(decorator.expression.arguments[0], 'name');
                preSweepFilesInformations[file].push({
                    type: 'pipe',
                    selector: selectorText ? selectorText.slice(1, -1) : '',
                    "class": className
                });
            }
        }
    });
    if (!preSweepFilesInformations[file].length) {
        preSweepFilesInformations[file].push({ type: 'other' });
    }
};
for (var _i = 0, javascriptAndTypescriptFiles_1 = javascriptAndTypescriptFiles; _i < javascriptAndTypescriptFiles_1.length; _i++) {
    var file = javascriptAndTypescriptFiles_1[_i];
    _loop_1(file);
}
var filesDepedencies = {};
var _loop_2 = function (file) {
    var sourceFile = host.getSourceFile(file, typescript_1["default"].ScriptTarget.ES2020);
    if (!sourceFile)
        return "continue";
    var fileDepedencies = [];
    var preSweepFileInformations = preSweepFilesInformations[file];
    // If the file is a module, we need to add the components that are entryComponents as depedencies
    // and ignore the rest of the imports.
    if (preSweepFileInformations[0].type === 'module') {
        for (var _i = 0, _a = Object.keys(preSweepFilesInformations); _i < _a.length; _i++) {
            var file_1 = _a[_i];
            var searchPreSweepFileInformations = preSweepFilesInformations[file_1];
            for (var _b = 0, searchPreSweepFileInformations_1 = searchPreSweepFileInformations; _b < searchPreSweepFileInformations_1.length; _b++) {
                var searchPreSweepFileInformation = searchPreSweepFileInformations_1[_b];
                if (searchPreSweepFileInformation.type === 'component' &&
                    preSweepFileInformations[0].entryComponents.includes(searchPreSweepFileInformation["class"])) {
                    fileDepedencies.push(file_1);
                }
            }
        }
    }
    else {
        sourceFile.forEachChild(function (node) {
            if (typescript_1["default"].isImportDeclaration(node)) {
                var moduleSpecifier = node.moduleSpecifier
                    .getText(sourceFile)
                    .slice(1, -1);
                var resolvedImportPath = resolveImportPathToRoot(moduleSpecifier, file);
                if (resolvedImportPath) {
                    fileDepedencies.push(resolvedImportPath);
                }
            }
        });
    }
    // If the file is a component or directive and has a templateUrl, we need to add it as a depedency.
    for (var _c = 0, preSweepFileInformations_3 = preSweepFileInformations; _c < preSweepFileInformations_3.length; _c++) {
        var preSweepFileInformation = preSweepFileInformations_3[_c];
        if ((preSweepFileInformation.type === 'component' || preSweepFileInformation.type === 'directive') &&
            preSweepFileInformation.templateUrl) {
            var resolvedTemplateUrl = resolveImportPathToRoot(preSweepFileInformation.templateUrl, file);
            if (resolvedTemplateUrl) {
                fileDepedencies.push(resolvedTemplateUrl);
            }
        }
    }
    filesDepedencies[file] = fileDepedencies;
};
for (var _a = 0, _b = Object.keys(preSweepFilesInformations); _a < _b.length; _a++) {
    var file = _b[_a];
    _loop_2(file);
}
var _loop_3 = function (file) {
    var fileDepedencies = [];
    var fileContent = fs_1["default"].readFileSync(file, 'utf8');
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
                    var loadPath = args.split(',')[0].slice(1, -1);
                    var resolvedImportPath = resolveImportPathToRoot(loadPath, file);
                    if (resolvedImportPath) {
                        fileDepedencies.push(resolvedImportPath);
                    }
                }
            }
        }
    });
    htmlParser.write(fileContent);
    htmlParser.end();
    filesDepedencies[file] = fileDepedencies;
};
for (var _c = 0, htmlFiles_1 = htmlFiles; _c < htmlFiles_1.length; _c++) {
    var file = htmlFiles_1[_c];
    _loop_3(file);
}
var depedencyGraph = {};
var getFilesDepedencyIsReferencedIn = function (file) {
    return Object.keys(filesDepedencies).filter(function (key) { return filesDepedencies[key].includes(file); });
};
var getRootModulesOfFile = function (file, visited) {
    if (visited === void 0) { visited = new Set(); }
    if (visited.has(file)) {
        return [];
    }
    visited.add(file);
    var references = getFilesDepedencyIsReferencedIn(file);
    if (references.length === 0) {
        return [file];
    }
    var rootFiles = [];
    for (var _i = 0, references_1 = references; _i < references_1.length; _i++) {
        var reference = references_1[_i];
        if (depedencyGraph[reference]) {
            rootFiles.push.apply(rootFiles, depedencyGraph[reference]);
        }
        else {
            rootFiles.push.apply(rootFiles, getRootModulesOfFile(reference, visited));
        }
    }
    return rootFiles.filter(function (rootFile) { return rootFile.endsWith('.module.ts'); });
};
for (var _d = 0, _e = Object.keys(filesDepedencies); _d < _e.length; _d++) {
    var file = _e[_d];
    depedencyGraph[file] = getRootModulesOfFile(file);
}
fs_1["default"].writeFileSync(path_1["default"].resolve(ROOT, 'depedency-graph.json'), JSON.stringify(depedencyGraph, null, 2));
