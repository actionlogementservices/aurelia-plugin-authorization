declare type Mandatory<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

/** Status of the authorization process. */
export type AuthorizationStatus = 'authorized' | 'unauthorized' | 'ongoing' | 'error';

/** Http client fetching the habilitations, typically an aurelia-fetch-client `HttpClient`. */
export type HttpClientLike = {
  fetch(input: string, init?: RequestInit): Promise<Response>;
};

/**
 * Plugin options, returned by the callback provided with
 * `aurelia.use.plugin('@actionlogementservices/aurelia-plugin-authorization', () => options)`.
 */
export type AuthorizationPluginOptions = {
  /** provides the http client used to fetch the habilitations, with the application interceptors (mandatory) */
  getHttpClient: () => HttpClientLike;
  /** url of the api route returning the habilitations (default `/api/1.0/utilisateurs/me/habilitations`) */
  habilitationsUrl?: string;
  /** timeout of the habilitations request in milliseconds (default `10000`) */
  timeout?: number;
  /** name of the route where the unauthorized navigations are redirected (default `accueil`) */
  homeRoute?: string;
  /** messages displayed for each authorization status, html allowed */
  messages?: Partial<Record<AuthorizationStatus, string>>;
  /** loads additional user data once the habilitations are loaded: a failure sets the `error` status */
  onHabilitationsLoaded?: (habilitations: { action: string; subject: string }[]) => Promise<void> | void;
};

/** Settings of a route protected by habilitations (`settings` of the aurelia route configuration). */
export type ProtectedRouteSettings = {
  /** habilitations required to navigate to the route */
  requiredHabilitations?: { action: string; subject: string }[];
  /** `'&&'` (default) when all the habilitations are required, `'||'` when one is enough */
  operator?: '&&' | '||';
};
