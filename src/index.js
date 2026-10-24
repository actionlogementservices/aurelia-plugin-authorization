/**
 * Defines the Aurelia plugin entry point.
 * @module
 * @category public
 */

import { PLATFORM } from 'aurelia-pal';
import { AuthorizationConfiguration } from './core/authorization-configuration';
export { AuthorizationConfiguration } from './core/authorization-configuration';
export { Authorizer, authorizationEvent } from './core/authorizer';
export { AuthorizeStep } from './core/authorize-step';
export { HabilitationService } from './core/habilitation-service';
export { Habilitation } from './models/habilitation';

/** @typedef {import('aurelia-framework').FrameworkConfiguration} FrameworkConfiguration */
/** @typedef {import('types').AuthorizationPluginOptions} AuthorizationPluginOptions */

/**
 * Configures the plugin.
 * @param {FrameworkConfiguration} aurelia aurelia framework
 * @param {() => AuthorizationPluginOptions} getOptions callback providing the plugin options
 * @throws {Error} when the http client provider is not provided
 */
function configure(aurelia, getOptions) {
  // aurelia provides an empty object when the plugin is registered without callback
  const options = typeof getOptions === 'function' ? getOptions() : undefined;
  aurelia.container.get(AuthorizationConfiguration).configure(options);
  aurelia.globalResources([
    PLATFORM.moduleName('./elements/authorization-status/authorization-status'),
    PLATFORM.moduleName('./value-converters/able')
  ]);
}

export { configure };
