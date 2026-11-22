import { inject } from 'aurelia-framework';
import { RedirectToRoute } from 'aurelia-router';
import { Connection } from '@actionlogementservices/aurelia-plugin-oidc';
import { AuthorizationConfiguration } from './authorization-configuration';
import { Authorizer } from './authorizer';

/** @typedef {import('aurelia-router').NavigationInstruction} NavigationInstruction */
/** @typedef {import('aurelia-router').Next} Next */

/**
 * Determines whether the navigation is public, i.e. reachable by a user who is not connected:
 * the navigated route (or the deepest child route defining it) explicitly sets `settings.authRequired: false`,
 * as with the `AuthenticateStep` of aurelia-plugin-oidc, and no route of the navigation requires habilitations.
 * @example
 * // a public faq route in an application requiring authentication by default
 * { route: 'faq', name: 'faq', moduleId: PLATFORM.moduleName('views/faq'), settings: { authRequired: false } }
 * @param {NavigationInstruction} navigationInstruction navigation instruction to analyze
 * @param {boolean} [parentIsPublic] value inherited from the parent route
 * @returns {boolean} true when a user who is not connected can navigate
 * @category internal
 */
export function isPublicNavigation(navigationInstruction, parentIsPublic = false) {
  const { authRequired, requiredHabilitations = [] } = navigationInstruction.config?.settings ?? {};
  if (requiredHabilitations.length > 0) return false;
  const isPublic = typeof authRequired === 'boolean' ? !authRequired : parentIsPublic;
  const childInstructions = Object.values(navigationInstruction.viewPortInstructions ?? {})
    .map(viewPortInstruction => viewPortInstruction.childNavigationInstruction)
    .filter(Boolean);
  if (childInstructions.length === 0) return isPublic;
  return childInstructions.every(childInstruction => isPublicNavigation(childInstruction, isPublic));
}

/**
 * Implements the **router authorize step** that redirects to the home route
 * when the user is not connected or not authorized to navigate to the route.
 * A user who is not connected can navigate to the public routes (see `isPublicNavigation`).
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
    const canNavigate = this._connection.isUserLoggedIn
      ? this._authorizer.isRouteAuthorized(navigationInstruction.config)
      : isPublicNavigation(navigationInstruction);
    return canNavigate ? next() : next.cancel(new RedirectToRoute(homeRoute));
  }
}
