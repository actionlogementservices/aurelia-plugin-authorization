/** @typedef {import('types').AuthorizationPluginOptions} AuthorizationPluginOptions */
/** @typedef {import('types').AuthorizationStatus} AuthorizationStatus */
/** @typedef {import('types').HttpClientLike} HttpClientLike */
/** @typedef {import('../models/habilitation').Habilitation} Habilitation */

/** Messages displayed for each authorization status, when not overridden by the `messages` option. */
const defaultMessages = {
  authorized: undefined,
  ongoing: 'Vérification de vos droits...',
  error: `Impossible de vérifier vos droits pour l'instant, merci de vous reconnecter ultérieurement.`,
  unauthorized: `Cette application nécessite une autorisation d'accès préalable. Veuillez vous rapprocher de votre responsable de service.`
};

/**
 * Holds the plugin configuration.
 * Registered as a singleton when the plugin is configured.
 * @category public
 */
export class AuthorizationConfiguration {
  /** Provides the http client used to fetch the habilitations. @type {() => HttpClientLike} */ getHttpClient;
  /** Url of the api route returning the habilitations of the connected user. @type {string} */ habilitationsUrl;
  /** Timeout of the habilitations request, in milliseconds. @type {number} */ timeout;
  /** Name of the route where the unauthorized navigations are redirected. @type {string} */ homeRoute;
  /** Message displayed for each authorization status. @type {Record<AuthorizationStatus, string | undefined>} */ messages;
  /** Loads additional user data once the habilitations are loaded. @type {(habilitations: Habilitation[]) => Promise<void> | void} */ onHabilitationsLoaded;

  /**
   * Applies the plugin options.
   * @param {Partial<AuthorizationPluginOptions>} [options] plugin options
   * @throws {Error} when the http client provider is not provided
   */
  configure(options = {}) {
    if (typeof options.getHttpClient !== 'function') {
      throw new TypeError('aurelia-plugin-authorization: the "getHttpClient" plugin option is required.');
    }
    this.getHttpClient = options.getHttpClient;
    this.habilitationsUrl = options.habilitationsUrl ?? '/api/1.0/utilisateurs/me/habilitations';
    this.timeout = options.timeout ?? 10_000;
    this.homeRoute = options.homeRoute ?? 'accueil';
    this.messages = { ...defaultMessages, ...options.messages };
    this.onHabilitationsLoaded = options.onHabilitationsLoaded;
  }
}
