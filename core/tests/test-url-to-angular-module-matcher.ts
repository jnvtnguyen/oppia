import constants from '../../assets/constants';
import path from 'path';
import ts from 'typescript';
import {
  TypescriptExtractorUtilities,
  readTypescriptConfig,
} from './typescript-extractor-utilities';

const ROOT_DIRECTORY = path.resolve(__dirname, '../../');

const APP_ROUTING_MODULE_PATH =
  'core/templates/pages/oppia-root/routing/app.routing.module.ts';

const ANGULAR_JS_URL_TO_MODULE_MAPPING = {};

class TestUrlToAngularModuleMatcher {
  typescriptHost: ts.CompilerHost;
  typescriptExtractorUtilities: TypescriptExtractorUtilities;
  urlToModuleMapping: Record<string, string> = {};

  constructor() {
    const typescriptConfigPath = path.resolve(ROOT_DIRECTORY, 'tsconfig.json');
    const typescriptConfig = readTypescriptConfig(typescriptConfigPath);
    this.typescriptHost = ts.createCompilerHost(typescriptConfig);
    this.typescriptExtractorUtilities = new TypescriptExtractorUtilities(
      typescriptConfig
    );
    this.urlToModuleMapping = {
      ...ANGULAR_JS_URL_TO_MODULE_MAPPING,
      ...this.getAngularUrlToModuleMapping()
    };
  }

  public getAngularUrlToModuleMapping(): Record<string, string> {
    const urlToAngularModuleMapping: Record<string, string> = {};
    const appRoutingModuleSourceFile = this.typescriptHost.getSourceFile(
      path.resolve(ROOT_DIRECTORY, APP_ROUTING_MODULE_PATH),
      ts.ScriptTarget.ES2020
    );
    if (!appRoutingModuleSourceFile) {
      throw new Error(`Failed to read app routing module source file`);
    }

    appRoutingModuleSourceFile.forEachChild((node: any) => {
      if (ts.isVariableStatement(node)) {
        const declaration: any = node.declarationList.declarations[0];
        const declarationName = declaration.name.getText(
          appRoutingModuleSourceFile
        );
        if (declarationName !== 'routes') {
          return;
        }
        const arrayElements = declaration.initializer.elements;
        for (const element of arrayElements) {
          let constantsClone: any = {...constants};
          let url: string | undefined;

          for (const property of element.properties) {
            const propertyName = property.name.getText(
              appRoutingModuleSourceFile
            );
            if (propertyName === 'path') {
              const stack: string[] = [];
              let initializer = property.initializer;
              while (initializer.expression) {
                stack.push(
                  initializer.name.getText(appRoutingModuleSourceFile)
                );
                initializer = initializer.expression;
              }
              while (stack.length) {
                const accessor = stack.pop();
                if (accessor) {
                  constantsClone = constantsClone[accessor];
                }
              }
              url = constantsClone;
            } else if (propertyName === 'loadChildren') {
              if (!url) {
                return;
              }
              const loadChildren = property.initializer.getText(
                appRoutingModuleSourceFile
              );
              const angularModule = /['"](.*?)['"]/.exec(loadChildren);
              if (angularModule) {
                const resolvedModulePath =
                  this.typescriptExtractorUtilities.resolveModulePathToFilePath(
                    this.typescriptExtractorUtilities.resolveExpressionIntoString(
                      angularModule[0]),
                    APP_ROUTING_MODULE_PATH
                  );
                if (resolvedModulePath) {
                  urlToAngularModuleMapping[url] = resolvedModulePath;
                }
              }
            }
          }
        }
      }
    });

    return urlToAngularModuleMapping;
  }
}

new TestUrlToAngularModuleMatcher();