import ts from 'typescript';
import path from 'path';
import fs from 'fs';
import { Parser as HtmlParser } from 'htmlparser2';

// This type is specific to Angular module files.
type AngularModuleInformation = {
  type: 'module';
  entryComponents: string[];
  class: string;
};

// This type is specific to Angular common files (components, directives, pipes).
type AngularCommonInformation = {
  type: 'component' | 'directive' | 'pipe';
  selector: string;
  class: string;
  templateUrl?: string;
};

type AngularInformation =
  | AngularModuleInformation
  | AngularCommonInformation
  | {type: 'none'};

// List of directories to exclude from the search.
const EXCLUSIONS = [
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
const ROOT = path.resolve(__dirname, '../../');
let fileAngularInformationsMapping: Record<string, AngularInformation[]> = {};

/*
 * Reads the tsconfig file and returns the parsed JSON.
 */
const readTSConfig = (tsConfigPath: string) => {
  const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (tsConfig.error) {
    throw tsConfig.error;
  }
  return tsConfig.config;
};

/*
 * Returns the relative path to the root directory.
 */
const getRelativePathToRoot = (filePath: string) => {
  return path.relative(ROOT, filePath);
};

/*
 * Returns the path by alias using the tsconfig file, if it exists.
 */
const getPathByAlias = (path: string): string | undefined => {
  for (const alias of Object.keys(tsConfig.compilerOptions.paths)) {
    const formattedAlias = alias.replace('/*', '');
    if (path.startsWith(formattedAlias)) {
      const fullAliasPath = tsConfig.compilerOptions.paths[alias][0].replace('/*', '');
      return path.replace(formattedAlias, fullAliasPath);
    }
  }
  return undefined;
};

/*
 * Provided a file path without an extension, it returns the file path with the
 * extension '.ts' or '.js' if it exists.
 */
const getFileWithExtensionByPathWithoutExtension = (path: string): string => {
  if (fs.existsSync(path + '.ts')) return path + '.ts';
  if (fs.existsSync(path + '.js')) return path + '.js';
  return path;
};

/*
 * Resolves any import path to the root directory.
 */
const resolveGenericImportPathToRoot = (importPath: string, relativeFile?: string): string | undefined => {
  if (importPath.startsWith('.') && relativeFile) {
    return getFileWithExtensionByPathWithoutExtension(
      getRelativePathToRoot(path.resolve(path.dirname(relativeFile), importPath))
    );
  } else {
    const pathByAlias = getPathByAlias(importPath);
    if (pathByAlias) {
      return getFileWithExtensionByPathWithoutExtension(pathByAlias);
    }
  }
};

/**
 * Finds the file depedency that corresponds to the given selector.
 */
const findSelectorDepedency = (selector: string): string | undefined => {
  for (const filePath of Object.keys(fileAngularInformationsMapping)) {
    const fileAngularInformation = fileAngularInformationsMapping[filePath];
    for (const angularInformation of fileAngularInformation) {
      if (
        (angularInformation.type === 'component' ||
         angularInformation.type === 'directive') &&
         angularInformation.selector === selector
      ) {
        return filePath;
      }
    }
  }
}

/**
 * Finds the file depedencies that corresponds to the given attributes.
 */
const findAttributesDepedencies = (attributes: Record<string, string>): string[] | undefined => {
  const depedencies: string[] = [];
  for (const attribute of Object.keys(attributes)) {
    const attributeValue = attributes[attribute];
    if (attribute.startsWith('[') && attribute.endsWith(']')) {
      const selectorDepedency = findSelectorDepedency(attributeValue);
      if (selectorDepedency) {
        depedencies.push(selectorDepedency);
      }
    }
  }

  return depedencies;
}

/**
 * Finds the pipe depedency that corresponds to the given expression.
 */
const findPipeDepedency = (expression: string): string | undefined => {
  if (!expression.includes('|')) return;
  const pipeFunction = expression.split('|')[1].split(':')[0].trim();
  for (const filePath of Object.keys(fileAngularInformationsMapping)) {
    const fileAngularInformation = fileAngularInformationsMapping[filePath];
    for (const angularInformation of fileAngularInformation) {
      if (
        angularInformation.type === 'pipe' &&
        angularInformation.selector === pipeFunction
      ) {
        return filePath;
      }
    }
  }
}

/**
 * Gets the file path by the class name if it exists.
 */
const getFileByClassName = (className: string): string | undefined => {
  for (const filePath of Object.keys(fileAngularInformationsMapping)) {
    for (const angularInformation of fileAngularInformationsMapping[filePath]) {
      if (
        angularInformation.type != 'none' &&
        angularInformation.class === className
      ) {
        return filePath;
      }
    }
  }
}

const tsConfig = readTSConfig(path.join(ROOT, 'tsconfig.json'));
let tsHost = ts.createCompilerHost(tsConfig);
const javascriptAndTypescriptFiles = tsHost.readDirectory!(ROOT, ['.ts', '.js'], EXCLUSIONS, []).reduce(
  (acc: string[], filePath: string) => {
    if (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js')) {
      acc.push(getRelativePathToRoot(filePath));
    }
    return acc;
  },
  []
);

const htmlFiles = tsHost.readDirectory!(ROOT, ['.html'], EXCLUSIONS, []).reduce(
  (acc: string[], filePath: string) => {
    acc.push(getRelativePathToRoot(filePath));
    return acc;
  },
  []
);

for (const filePath of javascriptAndTypescriptFiles) {
  const sourceFile = tsHost.getSourceFile(filePath, ts.ScriptTarget.ES2020);
  if (!sourceFile) continue;

  fileAngularInformationsMapping[filePath] = [];
  sourceFile.forEachChild(node => {
    if (!ts.isClassDeclaration(node)) {
      return;
    }
    if (!node.decorators) {
      return;
    }
    for (const decorator of node.decorators) {
      if (!ts.isCallExpression(decorator.expression)) {
        return;
      }
      const decoratorText = decorator.expression.expression.getText(sourceFile);
      if (
        !(
          decoratorText === 'Component' ||
          decoratorText === 'Directive' ||
          decoratorText === 'NgModule' ||
          decoratorText === 'Pipe'
        )
      ) {
        return;
      }

      const getPropertyInArgumentByText = (
        arg: ts.Expression,
        prop: string
      ): string | undefined => {
        if (ts.isObjectLiteralExpression(arg)) {
          for (const property of arg.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              property.name.getText(sourceFile) === prop
            ) {
              return property.initializer.getText(sourceFile);
            }
          }
        }
      };

      const className = node.name?.getText(sourceFile) || '';

      if (decoratorText === 'NgModule') {
        const entryComponentsText = getPropertyInArgumentByText(
          decorator.expression.arguments[0],
          'entryComponents'
        );
        fileAngularInformationsMapping[filePath].push({
          type: 'module',
          entryComponents: entryComponentsText
            ? entryComponentsText
                .slice(1, -1)
                .split(',')
                .map((entryComponent: string) => entryComponent.trim())
                .filter((entryComponent: string) => entryComponent !== '')
            : [],
          class: className,
        });
      } else if (decoratorText === 'Component' || decoratorText === 'Directive') {
        const selectorText = getPropertyInArgumentByText(
          decorator.expression.arguments[0],
          'selector'
        );
        const templateUrlText = getPropertyInArgumentByText(
          decorator.expression.arguments[0],
          'templateUrl'
        );
        fileAngularInformationsMapping[filePath].push({
          type: decoratorText.toLowerCase() as AngularCommonInformation['type'],
          selector: selectorText ? selectorText.slice(1, -1) : '',
          class: className,
          templateUrl: templateUrlText ? templateUrlText.slice(1, -1) : '',
        });
      } else if (decoratorText === 'Pipe') {
        const selectorText = getPropertyInArgumentByText(
          decorator.expression.arguments[0],
          'name'
        );
        fileAngularInformationsMapping[filePath].push({
          type: 'pipe',
          selector: selectorText ? selectorText.slice(1, -1) : '',
          class: className,
        });
      }
    }
  });

  // If the file doesn't have any Angular information, we add a 'none' type.
  if (!fileAngularInformationsMapping[filePath].length) {
    fileAngularInformationsMapping[filePath].push({type: 'none'});
  }
}


let fileDepedenciesMapping: Record<string, string[]> = {};
for (const filePath of Object.keys(fileAngularInformationsMapping)) {
  const sourceFile = tsHost.getSourceFile(filePath, ts.ScriptTarget.ES2020);
  if (!sourceFile) continue;

  const fileDepedencies: string[] = [];
  const fileAngularInformation = fileAngularInformationsMapping[filePath];

  // If the file is a module, we need to add the components that are entryComponents as depedencies
  // and ignore the rest of the imports.
  if (fileAngularInformation[0].type === 'module') {
    for (const entryComponent of fileAngularInformation[0].entryComponents) {
      const entryComponentFilePath = getFileByClassName(entryComponent);
      if (entryComponentFilePath) {
        fileDepedencies.push(entryComponentFilePath);
      }
    }
  }
  else {
    sourceFile.forEachChild(node => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier
          .getText(sourceFile)
          .slice(1, -1);

        const resolvedImportPath = resolveGenericImportPathToRoot(
          moduleSpecifier,
          filePath
        );
        if (resolvedImportPath) {
          fileDepedencies.push(resolvedImportPath);
        }
      }
    });
  }


  // If the file is a component or directive and has a templateUrl, we need to add it as a depedency.
  for (const angularInformation of fileAngularInformation) {
    if ((angularInformation.type === 'component' || angularInformation.type === 'directive') &&
        angularInformation.templateUrl
    ) {
      const resolvedTemplateUrl = resolveGenericImportPathToRoot(
        angularInformation.templateUrl,
        filePath
      );
      if (resolvedTemplateUrl) {
        fileDepedencies.push(resolvedTemplateUrl);
      }
    }
  }

  fileDepedenciesMapping[filePath] = fileDepedencies;
}

for (const filePath of htmlFiles) {
  const fileDepedencies: string[] = [];

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const htmlParser = new HtmlParser({
    onopentag(name: string, attributes: Record<string, string>) {
      const selectorDepedency = findSelectorDepedency(name);
      if (selectorDepedency) {
        fileDepedencies.push(selectorDepedency);
      }
      const attributesDepedencies = findAttributesDepedencies(attributes);
      if (attributesDepedencies) {
        fileDepedencies.push(...attributesDepedencies);
      }
      for (const attributeValue of Object.values(attributes)) {
        const pipeDepedency = findPipeDepedency(attributeValue);
        if (pipeDepedency) {
          fileDepedencies.push(pipeDepedency);
        }
      }
    },
    ontext(text: string) {
      const pipeDepedency = findPipeDepedency(text);
      if (pipeDepedency) {
        fileDepedencies.push(pipeDepedency);
      }
      if (text.includes('@load')) {
        const loadFunctions = text.split('\n').filter((line) => line.includes('@load'));
        for (const loadFunction of loadFunctions) {
          const args = loadFunction.substring(loadFunction.indexOf('(') + 1, loadFunction.indexOf(')'));
          const loadPath = args.split(',')[0].slice(1, -1);
          const resolvedImportPath = resolveGenericImportPathToRoot(
            loadPath,
            filePath
          );
          if (resolvedImportPath) {
            fileDepedencies.push(resolvedImportPath);
          }
        }
      }
    }
  });

  htmlParser.write(fileContent);
  htmlParser.end();
  fileDepedencies[filePath] = fileDepedencies;
}
