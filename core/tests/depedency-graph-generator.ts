import ts from 'typescript';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';

type BaseAngularInformation = {
  className: string;
};

type AngularModuleInformation = BaseAngularInformation & {
  type: 'module';
};

// This type is specific to Angular component files.
type AngularComponentInformation = BaseAngularInformation & {
  type: 'component';
  selector: string;
  templateUrl: string;
};

// This type is specific to Angular directive or pipe files.
type AngularDirectiveOrPipeInformation = BaseAngularInformation & {
  type: 'directive' | 'pipe';
  selector: string;
};

type AngularInformation =
  | AngularModuleInformation
  | AngularComponentInformation
  | AngularDirectiveOrPipeInformation;

// List of directories to exclude from the search.
const EXCLUSIONS = [
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
  'core/tests/services_source',
  'core/tests/webdriverio',
  'core/tests/webdriverio_desktop',
  'core/tests/webdriverio_utils',
];

const ROOT_DIRECTORY = path.resolve(__dirname, '../../');

const resolveExpressionIntoString = (expression: string): string => {
  if (expression.includes('+')) {
    const parts = expression.split('+');
    return parts
      .map(part => {
        return part.trim().slice(1, -1);
      })
      .join('');
  }
  return expression.slice(1, -1);
};

class DepedencyExtractor {
  typescriptHost: ts.CompilerHost;
  typescriptConfig: any;
  fileAngularInformationsMapping: Record<string, AngularInformation[]>;

  constructor(
    typescriptHost: ts.CompilerHost,
    typescriptConfig: any,
    fileAngularInformationsMapping: Record<string, AngularInformation[]>
  ) {
    this.typescriptHost = typescriptHost;
    this.typescriptConfig = typescriptConfig;
    this.fileAngularInformationsMapping = fileAngularInformationsMapping;
  }

  /*
   * Provided a file path without an extension, it returns the file path with the
   * extension '.ts' or '.js' if it exists.
   */
  private getFilePathWithExtension = (path: string): string => {
    if (fs.existsSync(path + '.ts')) return path + '.ts';
    if (fs.existsSync(path + '.js')) return path + '.js';
    return path;
  };

  /**
   * Checks if a file is a lib or not.
   */
  private isFilePathALib(filePath: string): boolean {
    const rootFilePath = filePath.substring(0, filePath.indexOf('/'));
    return fs.existsSync(
      path.resolve(ROOT_DIRECTORY, 'node_modules', rootFilePath)
    );
  }

  /**
   * Checks if a file path is relative or not.
   */
  private isFilePathRelative(filePath: string): boolean {
    return filePath.startsWith('.');
  }

  /**
   * Returns the path by alias using the TypeScript config, if it exists.
   */
  private resolvePathByAlias(filePath: string): string | undefined {
    for (const alias of Object.keys(
      this.typescriptConfig.compilerOptions.paths
    )) {
      const formattedAlias = alias.replace('/*', '');
      if (filePath.startsWith(formattedAlias)) {
        const fullAliasPath = this.typescriptConfig.compilerOptions.paths[
          alias
        ][0].replace('/*', '');
        return filePath.replace(formattedAlias, fullAliasPath);
      }
    }
  }

  /**
   * Resolves a module path to a file path relative to the root directory.
   */
  private resolveModulePathToFilePath(
    modulePath: string,
    relativeFilePath: string
  ): string | undefined {
    if (!this.isFilePathRelative(modulePath) && this.isFilePathALib(modulePath))
      return;
    const pathByAlias = this.resolvePathByAlias(modulePath);
    if (pathByAlias) {
      return this.getFilePathWithExtension(pathByAlias);
    }
    if (this.isFilePathRelative(modulePath)) {
      return this.getFilePathWithExtension(
        path.join(path.dirname(relativeFilePath), modulePath)
      );
    }
  }

  /**
   * Checks if the given file has a module declaration.
   */
  private doesFileHaveModuleDeclaration(filePath: string): boolean {
    const fileAngularInformations =
      this.fileAngularInformationsMapping[filePath];
    if (!fileAngularInformations) return false;
    return fileAngularInformations.some(info => info.type === 'module');
  }

  /**
   * Extracts the depedencies from the given TypeScript or Javascript file.
   */
  private extractDepedenciesFromTypescriptOrJavascriptFile(
    filePath: string
  ): string[] {
    const sourceFile = this.typescriptHost.getSourceFile(
      filePath,
      ts.ScriptTarget.ES2020
    );
    if (!sourceFile) {
      throw new Error(`Failed to read source file: ${filePath}.`);
    }

    const fileAngularInformations =
      this.fileAngularInformationsMapping[filePath];
    const fileDepedencies: string[] = [];

    sourceFile.forEachChild(node => {
      let modulePath: string | undefined;
      if (ts.isImportDeclaration(node)) {
        modulePath = resolveExpressionIntoString(
          node.moduleSpecifier.getText(sourceFile)
        );
      }
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression)
      ) {
        if (node.expression.expression.getText(sourceFile) !== 'require')
          return;
        modulePath = resolveExpressionIntoString(
          node.expression.arguments[0].getText(sourceFile)
        );
      }
      if (!modulePath) return;
      const resolvedModulePath = this.resolveModulePathToFilePath(
        modulePath,
        filePath
      );
      if (!resolvedModulePath) return;
      if (
        this.doesFileHaveModuleDeclaration(filePath) &&
        !this.doesFileHaveModuleDeclaration(resolvedModulePath)
      )
        return;
      fileDepedencies.push(resolvedModulePath);
    });

    for (const fileAngularInformation of fileAngularInformations) {
      if (fileAngularInformation.type === 'component') {
        fileDepedencies.push(fileAngularInformation.templateUrl);
      }
    }

    return Array.from(new Set(fileDepedencies));
  }

  /**
   * Extracts the depedencies from the given HTML file.
   */
  private extractDepedenciesFromHTMLFile(filePath: string): string[] {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const document = cheerio.load(fileContent);
    document('*')
      .children()
      .each((_, element) => {
        for (const [attributeName, attributeValue] of Object.entries(
          element.attribs
        )) {
          if (
            (attributeName.startsWith('[') && attributeName.endsWith(']')) ||
            (attributeName.startsWith('(') && attributeName.endsWith(')'))
          ) {
            document(element).removeAttr(attributeName);
            document(element).attr(attributeName.slice(1, -1), attributeValue);
          }
        }
      });

    const fileDepedencies: string[] = [];
    for (const [searchingFilePath, fileAngularInformations] of Object.entries(
      this.fileAngularInformationsMapping
    )) {
      for (const fileAngularInformation of fileAngularInformations) {
        if (
          fileAngularInformation.type === 'component' ||
          fileAngularInformation.type === 'directive'
        ) {
          const elementIsPresent =
            document(fileAngularInformation.selector).length > 0;
          if (!elementIsPresent) continue;
          fileDepedencies.push(searchingFilePath);
        }
      }
    }

    return Array.from(new Set(fileDepedencies));
  }

  /**
   * Gets the property value by its name from the given expression.
   */
  private getPropertyValueByNameFromExpression(
    expression: ts.Expression,
    propertyName: string,
    sourceFile: ts.SourceFile
  ): string | undefined {
    if (!ts.isObjectLiteralExpression(expression)) return;
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (
        ts.isIdentifier(property.name) &&
        property.name.getText(sourceFile) === propertyName
      ) {
        return resolveExpressionIntoString(
          property.initializer.getText(sourceFile)
        );
      }
    }
  }

  /**
   * Extracts the dependencies from the given file path.
   */
  public extractDepedenciesFromFile(filePath: string): string[] {
    const fileExtension = path.extname(filePath);
    if (fileExtension === '.ts' || fileExtension === '.js') {
      return this.extractDepedenciesFromTypescriptOrJavascriptFile(filePath);
    } else if (fileExtension === '.html') {
      return this.extractDepedenciesFromHTMLFile(filePath);
    } else {
      throw new Error(`Unsupported file extension: ${fileExtension}.`);
    }
  }

  /**
   * Extracts the Angular informations from the given file path.
   */
  public extractAngularInformationsFromFile(
    filePath: string
  ): AngularInformation[] {
    const sourceFile = this.typescriptHost.getSourceFile(
      filePath,
      ts.ScriptTarget.ES2020
    );
    if (!sourceFile) {
      throw new Error(`Failed to read source file: ${filePath}.`);
    }

    const fileAngularInformations: AngularInformation[] = [];
    sourceFile.forEachChild(node => {
      if (!ts.isClassDeclaration(node) || !node.decorators || !node.name)
        return;
      for (const decorator of node.decorators) {
        if (!ts.isCallExpression(decorator.expression)) continue;
        const decoratorText =
          decorator.expression.expression.getText(sourceFile);
        const className = node.name.getText(sourceFile);
        if (decoratorText === 'NgModule') {
          fileAngularInformations.push({
            type: 'module',
            className,
          });
        } else if (decoratorText === 'Component') {
          const selectorText = this.getPropertyValueByNameFromExpression(
            decorator.expression.arguments[0],
            'selector',
            sourceFile
          );
          const templateUrlText = this.getPropertyValueByNameFromExpression(
            decorator.expression.arguments[0],
            'templateUrl',
            sourceFile
          );
          if (!selectorText || !templateUrlText) continue;
          const resolvedTemplateUrl = this.resolveModulePathToFilePath(
            templateUrlText,
            filePath
          );
          if (!resolvedTemplateUrl) continue;
          fileAngularInformations.push({
            type: 'component',
            selector: selectorText,
            templateUrl: resolvedTemplateUrl,
            className,
          });
        } else if (decoratorText === 'Directive' || decoratorText === 'Pipe') {
          const selectorText = this.getPropertyValueByNameFromExpression(
            decorator.expression.arguments[0],
            'selector',
            sourceFile
          );
          if (!selectorText) continue;
          fileAngularInformations.push({
            type: decoratorText === 'Directive' ? 'directive' : 'pipe',
            selector: selectorText,
            className,
          });
        }
      }
    });

    return fileAngularInformations;
  }
}

class DepedencyGraphGenerator {
  typescriptHost: ts.CompilerHost;
  typescriptConfig: any;
  files: string[];

  constructor(typescriptConfigPath: string) {
    this.typescriptConfig = this.readTypescriptConfig(typescriptConfigPath);
    this.typescriptHost = ts.createCompilerHost(this.typescriptConfig);

    this.files = this.typescriptHost.readDirectory!(
      ROOT_DIRECTORY,
      ['.ts', '.js', '.html'],
      EXCLUSIONS,
      []
    ).reduce((acc: string[], filePath: string) => {
      if (!filePath.endsWith('.spec.ts') && !filePath.endsWith('.spec.js')) {
        acc.push(path.relative(ROOT_DIRECTORY, filePath));
      }
      return acc;
    }, []);
  }

  /**
   * Reads the tsconfig file and returns the parsed configuration.
   */
  private readTypescriptConfig(typescriptConfigPath: string): any {
    const typescriptConfig = ts.readConfigFile(
      typescriptConfigPath,
      ts.sys.readFile
    );
    if (typescriptConfig.error) {
      throw new Error(
        `Failed to read TypeScript configuration: ${typescriptConfigPath}.`
      );
    }
    return typescriptConfig.config;
  }

  /**
   * Gets the angular informations of the files.
   */
  private getFileAngularInformationsMapping(): Record<
    string,
    AngularInformation[]
  > {
    const fileAngularInformationsMapping: Record<string, AngularInformation[]> =
      {};
    for (const filePath of this.files) {
      const depedencyExtractor = new DepedencyExtractor(
        this.typescriptHost,
        this.typescriptConfig,
        fileAngularInformationsMapping
      );
      fileAngularInformationsMapping[filePath] =
        depedencyExtractor.extractAngularInformationsFromFile(filePath);
    }

    return fileAngularInformationsMapping;
  }

  /**
   * Generates the depedency graph.
   */
  public generateDepedencyGraph(): Record<string, string[]> {
    const fileAngularInformationsMapping =
      this.getFileAngularInformationsMapping();
    const depedencyExtractor = new DepedencyExtractor(
      this.typescriptHost,
      this.typescriptConfig,
      fileAngularInformationsMapping
    );

    const depedencyGraph: Record<string, string[]> = {};
    for (const filePath of this.files) {
      depedencyGraph[filePath] =
        depedencyExtractor.extractDepedenciesFromFile(filePath);
    }
    return depedencyGraph;
  }
}

const depedencyGraphGenerator = new DepedencyGraphGenerator(
  path.resolve(ROOT_DIRECTORY, 'tsconfig.json')
);

const depedencyGraph = depedencyGraphGenerator.generateDepedencyGraph();
fs.writeFileSync(
  path.resolve(ROOT_DIRECTORY, 'dependency-graph.json'),
  JSON.stringify(depedencyGraph, null, 2)
);
