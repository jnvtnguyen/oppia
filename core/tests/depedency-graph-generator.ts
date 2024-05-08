import ts from 'typescript';
import path from 'path';
import fs from 'fs';
import {Parser as HtmlParser} from 'htmlparser2';
import jsdom from 'jsdom';

// This type is specific to Angular module files.
type AngularModuleInformation = {
  type: 'module';
  entryComponents: string[];
  class: string;
};

// This type is specific to Angular common files (components, directives, pipes).
type AngularCommonInformation = {
  type: 'component' | 'directive' | 'pipe';
  selector?: string;
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
  '.direnv',
];

const ROOT = path.resolve(__dirname, '../../');

/**
 * Resolves a expression into a raw string.
 */
const resolveExpressionIntoString = (expression: string): string => {
  if (expression.includes('+')) {
    const parts = expression.split('+');
    return parts
      .map(part => {
        return part.trim().slice(1, -1);
      })
      .join('');
  }
  if (expression.startsWith("'") && expression.endsWith("'")) {
    return expression.slice(1, -1);
  }
  return expression;
};

class DepedencyExtractor {
  filePath: string;
  fileType: 'ts' | 'js' | 'html';
  angularInformationMapping: Record<string, AngularInformation[]>;
  tsHost: ts.CompilerHost;
  tsConfig: any;

  constructor(
    filePath: string,
    angularInformationMapping: Record<string, AngularInformation[]>,
    tsHost: ts.CompilerHost,
    tsConfig: any
  ) {
    this.filePath = filePath;
    this.fileType = this.filePath.split('.').pop() as 'ts' | 'js' | 'html';
    this.angularInformationMapping = angularInformationMapping;
    this.tsHost = tsHost;
    this.tsConfig = tsConfig;
  }

  /*
   * Returns the path by alias using the tsconfig file, if it exists.
   */
  private getPathByAlias = (path: string): string | undefined => {
    for (const alias of Object.keys(this.tsConfig.compilerOptions.paths)) {
      const formattedAlias = alias.replace('/*', '');
      if (path.startsWith(formattedAlias)) {
        const fullAliasPath = this.tsConfig.compilerOptions.paths[
          alias
        ][0].replace('/*', '');
        return path.replace(formattedAlias, fullAliasPath);
      }
    }
    return undefined;
  };

  /*
   * Provided a file path without an extension, it returns the file path with the
   * extension '.ts' or '.js' if it exists.
   */
  private getFileWithExtensionByPathWithoutExtension = (
    path: string
  ): string => {
    if (fs.existsSync(path + '.ts')) return path + '.ts';
    if (fs.existsSync(path + '.js')) return path + '.js';
    return path;
  };

  /**
   * Resolves any import path to the root directory.
   */
  private resolveGenericImportPathToRoot(
    importPath: string,
    relativeFile: string
  ): string | undefined {
    if (
      !importPath.startsWith('.') &&
      fs.existsSync(
        path.resolve(
          ROOT,
          'node_modules',
          importPath.substring(0, importPath.indexOf('/'))
        )
      )
    )
      return;
    const pathByAlias = this.getPathByAlias(importPath);
    if (pathByAlias) {
      return this.getFileWithExtensionByPathWithoutExtension(pathByAlias);
    }
    return this.getFileWithExtensionByPathWithoutExtension(
      path.join(path.dirname(relativeFile), importPath)
    );
  }

  /**
   * Finds the file depedency by the given selector.
   */
  private findSelectorDepedency(selector: string): string | undefined {
    for (const filePath of Object.keys(this.angularInformationMapping)) {
      const fileAngularInformation = this.angularInformationMapping[filePath];
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
  private findAttributesDepedencies(
    attributes: Record<string, string>
  ): string[] | undefined {
    const depedencies: string[] = [];
    for (const attribute of Object.keys(attributes)) {
      const selectorDepedency = this.findSelectorDepedency(attribute);
      if (selectorDepedency) {
        depedencies.push(selectorDepedency);
      }
    }

    return depedencies;
  }

  /**
   * Finds the pipe depedency that corresponds to the given expression.
   */
  private findPipeDepedency(expression: string): string | undefined {
    if (!expression.includes('|')) return;
    const pipeFunction = expression.split('|')[1].split(':')[0].trim();
    for (const filePath of Object.keys(this.angularInformationMapping)) {
      const fileAngularInformation = this.angularInformationMapping[filePath];
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
   * Gets the file path by its class name if it exists.
   */
  private getFileByClassName(className: string): string | undefined {
    for (const filePath of Object.keys(this.angularInformationMapping)) {
      for (const angularInformation of this.angularInformationMapping[
        filePath
      ]) {
        if (
          angularInformation.type != 'none' &&
          angularInformation.class === className
        ) {
          return filePath;
        }
      }
    }
  }

  /**
   * Extracts the depedencies from the file.
   */
  public extractDepedencies(): string[] {
    const fileDepedencies: string[] = [];
    if (this.fileType === 'ts' || this.fileType === 'js') {
      const sourceFile = this.tsHost.getSourceFile(
        this.filePath,
        ts.ScriptTarget.ES2020
      );
      if (!sourceFile) return [];

      const angularInformations =
        this.angularInformationMapping[this.filePath];

      // If the file is a module, we need to add the components that are entryComponents as depedencies
      // and ignore the rest of the imports.
      if (angularInformations[0].type === 'module') {
        for (const entryComponent of angularInformations[0]
          .entryComponents) {
          const entryComponentFilePath =
            this.getFileByClassName(entryComponent);
          if (entryComponentFilePath) {
            fileDepedencies.push(entryComponentFilePath);
          }
        }
      } else {
        sourceFile.forEachChild(node => {
          if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier.getText(sourceFile);

            const resolvedImportPath = this.resolveGenericImportPathToRoot(
              resolveExpressionIntoString(moduleSpecifier),
              this.filePath
            );
            if (resolvedImportPath) {
              fileDepedencies.push(resolvedImportPath);
            }
          }
          if (ts.isExpressionStatement(node)) {
            if (!ts.isCallExpression(node.expression)) return;
            if (node.expression.expression.getText(sourceFile) !== 'require')
              return;
            const importArgument =
              node.expression.arguments[0].getText(sourceFile);
            const resolvedImportPath = this.resolveGenericImportPathToRoot(
              resolveExpressionIntoString(importArgument),
              this.filePath
            );
            if (resolvedImportPath) {
              fileDepedencies.push(resolvedImportPath);
            }
          }
        });
      }

      // If the file is a component or directive and has a templateUrl, we need to add it as a depedency.
      for (const angularInformation of angularInformations) {
        if (
          (angularInformation.type === 'component' ||
            angularInformation.type === 'directive') &&
          angularInformation.templateUrl
        ) {
          const resolvedTemplateUrlFilePath =
            this.resolveGenericImportPathToRoot(
              angularInformation.templateUrl,
              this.filePath
            );
          if (resolvedTemplateUrlFilePath) {
            fileDepedencies.push(resolvedTemplateUrlFilePath);
          }
        }
      }

      return fileDepedencies;
    } else if (this.fileType === 'html') {
      const fileContent = fs.readFileSync(this.filePath, 'utf8');
      const that = this;
      const htmlParser = new HtmlParser({
        onopentag(name: string, attributes: Record<string, string>) {
          const selectorDepedency = that.findSelectorDepedency(name);
          if (selectorDepedency) {
            fileDepedencies.push(selectorDepedency);
          }
          const attributesDepedencies =
            that.findAttributesDepedencies(attributes);
          if (attributesDepedencies) {
            fileDepedencies.push(...attributesDepedencies);
          }
          for (const attributeValue of Object.values(attributes)) {
            const pipeDepedency = that.findPipeDepedency(attributeValue);
            if (pipeDepedency) {
              fileDepedencies.push(pipeDepedency);
            }
          }
        },
        ontext(text: string) {
          const pipeDepedency = that.findPipeDepedency(text);
          if (pipeDepedency) {
            fileDepedencies.push(pipeDepedency);
          }
          if (text.includes('@load')) {
            const loadFunctions = text
              .split('\n')
              .filter(line => line.includes('@load'));
            for (const loadFunction of loadFunctions) {
              const args = loadFunction.substring(
                loadFunction.indexOf('(') + 1,
                loadFunction.indexOf(')')
              );
              const loadPath = resolveExpressionIntoString(args.split(',')[0]);
              const resolvedLoadPath = that.resolveGenericImportPathToRoot(
                loadPath,
                this.filePath
              );
              if (resolvedLoadPath) {
                fileDepedencies.push(resolvedLoadPath);
              }
            }
          }
        },
      });

      htmlParser.write(fileContent);
      htmlParser.end();
    }
    return Array.from(new Set(fileDepedencies));
  }
}

class DepedencyGraphGenerator {
  tsHost: ts.CompilerHost;
  tsConfig: any;
  javascriptAndTypescriptFiles: string[];
  htmlFiles: string[];

  constructor(tsConfigPath: string) {
    this.tsConfig = this.readTSConfig(tsConfigPath);
    this.tsHost = ts.createCompilerHost(this.tsConfig);

    this.javascriptAndTypescriptFiles = this.tsHost.readDirectory!(
      ROOT,
      ['.ts', '.js'],
      EXCLUSIONS,
      []
    ).reduce((acc: string[], filePath: string) => {
      if (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js')) {
        acc.push(this.getRelativePathToRoot(filePath));
      }
      return acc;
    }, []);

    this.htmlFiles = this.tsHost.readDirectory!(
      ROOT,
      ['.html'],
      EXCLUSIONS,
      []
    ).reduce((acc: string[], filePath: string) => {
      acc.push(this.getRelativePathToRoot(filePath));
      return acc;
    }, []);
  }

  /**
   * Reads the tsconfig file and returns the parsed JSON.
   */
  private readTSConfig = (tsConfigPath: string): any => {
    const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (tsConfig.error) {
      throw tsConfig.error;
    }
    return tsConfig.config;
  };

  /*
   * Returns the relative path to the root directory.
   */
  private getRelativePathToRoot = (filePath: string) => {
    return path.relative(ROOT, filePath);
  };

  /**
   * Gets the angular information of the files.
   */
  private getAngularInformationMapping(): Record<string, AngularInformation[]> {
    const angularInformationMapping: Record<string, AngularInformation[]> = {};
    for (const filePath of this.javascriptAndTypescriptFiles) {
      const sourceFile = this.tsHost.getSourceFile(
        filePath,
        ts.ScriptTarget.ES2020
      );
      if (!sourceFile) continue;

      angularInformationMapping[filePath] = [];
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
          const decoratorText =
            decorator.expression.expression.getText(sourceFile);
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
            angularInformationMapping[filePath].push({
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
          } else if (
            decoratorText === 'Component' ||
            decoratorText === 'Directive'
          ) {
            const selectorText =
              getPropertyInArgumentByText(
                decorator.expression.arguments[0],
                'selector'
              );
            const templateUrlText =
              getPropertyInArgumentByText(
                decorator.expression.arguments[0],
                'templateUrl'
              );
            angularInformationMapping[filePath].push({
              type: decoratorText.toLowerCase() as AngularCommonInformation['type'],
              selector: selectorText && resolveExpressionIntoString(selectorText),
              class: className,
              templateUrl: templateUrlText && resolveExpressionIntoString(templateUrlText),
            });
          } else if (decoratorText === 'Pipe') {
            const selectorText =
              getPropertyInArgumentByText(
                decorator.expression.arguments[0],
                'name'
              );
            angularInformationMapping[filePath].push({
              type: 'pipe',
              selector: selectorText && resolveExpressionIntoString(selectorText),
              class: className,
            });
          }
        }
      });

      // If the file doesn't have any Angular information, we add a 'none' type.
      if (!angularInformationMapping[filePath].length) {
        angularInformationMapping[filePath].push({type: 'none'});
      }
    }
    return angularInformationMapping;
  }

  /**
   * Generates the file depedencies mapping.
   */
  private generateFileDepedenciesMapping(
    angularInformationMapping: Record<string, AngularInformation[]>
  ): Record<string, string[]> {
    const allFiles = [...this.javascriptAndTypescriptFiles, ...this.htmlFiles];
    const fileDepedenciesMapping: Record<string, string[]> = {};
    for (const filePath of allFiles) {
      const depedencyExtractor = new DepedencyExtractor(
        filePath,
        angularInformationMapping,
        this.tsHost,
        this.tsConfig
      );
      fileDepedenciesMapping[filePath] =
        depedencyExtractor.extractDepedencies();
    }
    return fileDepedenciesMapping;
  }

  /**
   * Generates the depedency graph.
   */
  public generateDepedencyGraph(
    generateFile: boolean = true
  ): Record<string, string[]> {
    const angularInformationMapping = this.getAngularInformationMapping();
    const fileDepedenciesMapping = this.generateFileDepedenciesMapping(
      angularInformationMapping
    );
    fs.writeFileSync(
      path.join(ROOT, 'dependency-graph.json'),
      JSON.stringify(fileDepedenciesMapping, null, 2)
    );
    return {};
  }
}

new DepedencyGraphGenerator(path.resolve(ROOT, 'tsconfig.json')).generateDepedencyGraph();