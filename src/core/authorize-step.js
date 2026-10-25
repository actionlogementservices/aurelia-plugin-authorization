import { inject } from 'aurelia-framework';
import { RedirectToRoute } from 'aurelia-router';
import { Connection } from '@actionlogementservices/aurelia-plugin-oidc';
import { AuthorizationConfiguration } from './authorization-configuration';
import { Authorizer } from './authorizer';

/** @typedef {import('aurelia-router').NavigationInstruction} NavigationInstruction */
/** @typedef {import('aurelia-router').Next} Next */

/**
 * Implements the **router authorize step** that redirects to the home route
 * when the user is not connected or not authorized to navigate to the route.
 * @example
 * configuration.addAuthorizeStep(AuthorizeStep);
 * @category public
 */
@inject(Connection, Authorizer, AuthorizationConfiguration)
export class AuthorizeStep {
  /**
   * Creates an instance of the authorize step.
   * @param {Connection} connection openid user connection
   * @param {Authorizer} authorizer authorization system
   * @param {AuthorizationConfiguration} configuration plugin configuration
   */
  constructor(connection, authorizer, configuration) {
    this._connection = connection;
    this._authorizer = authorizer;
    this._configuration = configuration;
  }

  /**
   * Validates the navigation.
   * @param {NavigationInstruction} navigationInstruction navigation instruction to validate
   * @param {Next} next navigation pipeline processor
   * @returns {Promise<any>} navigation pipeline result
   */
  run(navigationInstruction, next) {
    // the routers navigate again once the habilitations are loaded
    if (this._authorizer.status === 'ongoing') return next();
    const { homeRoute } = this._configuration;
    if (navigationInstruction.config.name === homeRoute) return next();
    const canNavigate =
      this._connection.isUserLoggedIn && this._authorizer.isRouteAuthorized(navigationInstruction.config);
    return canNavigate ? next() : next.cancel(new RedirectToRoute(homeRoute));
  }
}
