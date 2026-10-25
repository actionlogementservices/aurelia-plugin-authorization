import { inject, computedFrom, LogManager, TaskQueue } from 'aurelia-framework';
import { signalBindings } from 'aurelia-binding';
import { EventAggregator } from 'aurelia-event-aggregator';
import { PureAbility } from '@casl/ability';
import { Connection } from '@actionlogementservices/aurelia-plugin-oidc';
import { AuthorizationConfiguration } from './authorization-configuration';
import { HabilitationService } from './habilitation-service';

/** @typedef {import('aurelia-router').Router} Router */
/** @typedef {import('aurelia-router').RouteConfig} RouteConfig */
/** @typedef {import('aurelia-event-aggregator').Subscription} Subscription */
/** @typedef {import('types').AuthorizationStatus} AuthorizationStatus */
/** @typedef {import('types').ProtectedRouteSettings} ProtectedRouteSettings */
/** @typedef {import('../models/habilitation').Habilitation} Habilitation */

const logger = LogManager.getLogger('aurelia-plugin-authorization');

/**
 * Names of the events published with the event aggregator, also used as binding signals.
 * @category public
 */
export const authorizationEvent = {
  /** the habilitations have changed (published with the ability once the status is settled) */ changed:
    'habilitationsChanged',
  /** the user is authorized (published with the ability) */ authorized: 'userAuthorized'
};

/** Bootstrap alert type of each authorization status. @type {Record<AuthorizationStatus, string>} */
const alertTypes = { authorized: 'info', ongoing: 'info', error: 'danger', unauthorized: 'warning' };

/**
 * Implements the **authorization system**: it loads the habilitations of the connected user,
 * synchronizes the casl ability and the routers, and exposes the authorization process status.
 * @category public
 */
@inject(Connection, HabilitationService, PureAbility, EventAggregator, TaskQueue, AuthorizationConfiguration)
export class Authorizer {
  /** Authorization status of the user (undefined before the first synchronization). @type {AuthorizationStatus} */ status;
  /** Message of the authorization process status. @type {string} */ message;
  /** Bootstrap alert type of the authorization process status. @type {string} */ alertType;
  /** Habilitations of the connected user. @type {Habilitation[]} */ habilitations = [];

  /**
   * Creates an instance of the authorization system.
   * @param {Connection} connection openid user connection
   * @param {HabilitationService} habilitationService habilitations retrieval service
   * @param {PureAbility} ability casl ability holding the habilitations
   * @param {EventAggregator} eventAggregator event aggregator
   * @param {TaskQueue} taskQueue aurelia asynchronous task queue
   * @param {AuthorizationConfiguration} configuration plugin configuration
   */
  constructor(connection, habilitationService, ability, eventAggregator, taskQueue, configuration) {
    this._connection = connection;
    this._habilitationService = habilitationService;
    this._ability = ability;
    this._eventAggregator = eventAggregator;
    this._taskQueue = taskQueue;
    this._configuration = configuration;
    this._ability.on('updated', () => signalBindings(authorizationEvent.changed));
    this._connection.observeUser(user => this._synchronizePermissions(user));
  }

  /**
   * Habilitations of the connected user grouped by subject, typically displayed in the user profile.
   * @type {{ subject: string, actions: string[] }[]}
   */
  @computedFrom('habilitations')
  get habilitationsBySubject() {
    const groups = [];
    for (const { subject, action } of this.habilitations) {
      const group = groups.find(g => g.subject === subject);
      if (group) group.actions.push(action);
      else groups.push({ subject, actions: [action] });
    }
    return groups;
  }

  /**
   * Reconfigures the specified router with its authorized routes each time the habilitations change.
   * @param {Router} router router to reconfigure
   * @param {RouteConfig[]} routes route definitions of the router
   * @returns {Subscription} subscription to dispose when the router is detached
   */
  synchroniseRouter(router, routes) {
    return this._eventAggregator.subscribe(authorizationEvent.changed, () =>
      this._reconfigureRouter(router, routes)
    );
  }

  /**
   * Subscribes to the habilitations changes.
   * @param {(ability: PureAbility) => void} callback callback called with the ability
   * @returns {Subscription} subscription to dispose
   */
  onHabilitationsChanged(callback) {
    return this._eventAggregator.subscribe(authorizationEvent.changed, callback);
  }

  /**
   * Subscribes to the user authorization.
   * @param {(ability: PureAbility) => void} callback callback called with the ability
   * @returns {Subscription} subscription to dispose
   */
  onUserAuthorized(callback) {
    return this._eventAggregator.subscribe(authorizationEvent.authorized, callback);
  }

  /**
   * Can the user perform the specified action on the specified subject?
   * @param {string} action action on the subject
   * @param {string} subject protected resource
   * @returns {boolean} true when allowed
   */
  can(action, subject) {
    return this._ability.can(action, subject);
  }

  /**
   * Is the specified route authorized by the user habilitations?
   * A route without `settings.requiredHabilitations` is always authorized.
   * The required habilitations are all needed unless `settings.operator` is `'||'`.
   * @param {RouteConfig} route route to check
   * @returns {boolean} true when authorized
   */
  isRouteAuthorized(route) {
    /** @type {ProtectedRouteSettings} */ const { requiredHabilitations = [], operator } =
      route.settings ?? {};
    if (requiredHabilitations.length === 0) return true;
    return operator === '||'
      ? requiredHabilitations.some(({ action, subject }) => this.can(action, subject))
      : requiredHabilitations.every(({ action, subject }) => this.can(action, subject));
  }

  /**
   * Filters the authorized routes, typically mapped by a child router.
   * All the routes are returned while the habilitations are loading.
   * @param {RouteConfig[]} routes route definitions
   * @returns {RouteConfig[]} authorized routes
   */
  getAuthorizedRoutes(routes) {
    if (this.status === 'ongoing') return routes;
    const authorizedRoutes = routes.filter(route => this.isRouteAuthorized(route));
    // the router reuses the navigation model of a route, which may belong to a previous router
    for (const route of authorizedRoutes) delete route.navModel;
    return authorizedRoutes;
  }

  /**
   * Reconfigures the specified router with its authorized routes then navigates again.
   * @param {Router} router router to reconfigure
   * @param {RouteConfig[]} routes route definitions of the router
   */
  _reconfigureRouter(router, routes) {
    if (!router.currentInstruction || !this._connection.isUserLoggedIn) return;
    const isApplicationRouter = !router.parent;
    const authorizedRoutes = this.getAuthorizedRoutes(routes);
    logger.debug(
      `Reconfiguring the ${isApplicationRouter ? 'application' : 'child'} router with the routes: ${authorizedRoutes.map(r => r.name).join(', ')}`
    );
    router.navigation = [];
    router.routes = [];
    for (const route of authorizedRoutes) router.addRoute(route);
    router.refreshNavigation();
    this._deferNavigation(router, isApplicationRouter);
  }

  /**
   * Navigates again to the current route when still authorized, or to the default route otherwise.
   * @param {Router} router reconfigured router
   * @param {boolean} isApplicationRouter is it the application router?
   */
  _deferNavigation(router, isApplicationRouter) {
    const { fragment, queryString, config } = router.currentInstruction;
    // the application router navigates first
    const defer = isApplicationRouter
      ? callback => this._taskQueue.queueMicroTask(callback)
      : callback => this._taskQueue.queueTask(callback);
    defer(() => {
      const isAuthorized = router.routes.some(route => route.name === config.name);
      const currentUrl = queryString ? `${fragment}?${queryString}` : fragment;
      const url = isAuthorized ? currentUrl : '';
      logger.debug(`Navigating the ${isApplicationRouter ? 'application' : 'child'} router to '${url}'`);
      router.navigate(url, { replace: true });
    });
  }

  /**
   * Loads the habilitations of the user and synchronizes the permissions.
   * @param {any} user openid user, null when disconnected
   */
  async _synchronizePermissions(user) {
    // the user is reloaded during the silent login
    if (this._connection.inProgress) return;
    if (!user) {
      this._synchronizeUiPermissions([], 'unauthorized');
      return;
    }
    this._synchronizeUiPermissions([], 'ongoing');
    try {
      const habilitations = await this._habilitationService.getHabilitations();
      await this._configuration.onHabilitationsLoaded?.(habilitations);
      this._synchronizeUiPermissions(habilitations);
    } catch (error) {
      logger.error('Unable to load the habilitations', error);
      this._synchronizeUiPermissions([], 'error');
    }
  }

  /**
   * Updates the status and the ability with the specified habilitations then publishes the events.
   * @param {Habilitation[]} habilitations habilitations of the user
   * @param {AuthorizationStatus} [status] authorization status, deduced from the habilitations when not specified
   */
  _synchronizeUiPermissions(habilitations, status) {
    this.habilitations = habilitations;
    this.status = status ?? (habilitations.length === 0 ? 'unauthorized' : 'authorized');
    this.message = this._configuration.messages[this.status];
    this.alertType = alertTypes[this.status];
    logger.debug(
      `Habilitations (${this.status}): ${habilitations.map(h => `${h.action}:${h.subject}`).join(', ')}`
    );
    this._ability.update(habilitations);
    if (this.status !== 'ongoing') {
      this._taskQueue.queueTask(() =>
        this._eventAggregator.publish(authorizationEvent.changed, this._ability)
      );
    }
    if (this.status === 'authorized') {
      this._taskQueue.queueTask(() =>
        this._eventAggregator.publish(authorizationEvent.authorized, this._ability)
      );
    }
  }
}
