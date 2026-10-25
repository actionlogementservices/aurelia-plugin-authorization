import { inject } from 'aurelia-framework';
import { AuthorizationConfiguration } from './authorization-configuration';
import { Habilitation } from '../models/habilitation';

/** @typedef {import('types').HttpClientLike} HttpClientLike */

/**
 * Implements the retrieval of the connected user habilitations.
 * Register a subclass for the `HabilitationService` key to retrieve them differently.
 * @category public
 */
@inject(AuthorizationConfiguration)
export class HabilitationService {
  /** Plugin configuration. @type {AuthorizationConfiguration} */ _configuration;
  /** Http client, created on first use. @type {HttpClientLike} */ _client;

  /**
   * Creates an instance of the service.
   * @param {AuthorizationConfiguration} configuration plugin configuration
   */
  constructor(configuration) {
    this._configuration = configuration;
  }

  /**
   * Retrieves the habilitations of the connected user. A 403 response means that the user has no habilitation.
   * @returns {Promise<Habilitation[]>} habilitations of the connected user
   */
  async getHabilitations() {
    const { habilitationsUrl, timeout } = this._configuration;
    this._client ??= this._configuration.getHttpClient();
    let response;
    try {
      response = await this._client.fetch(habilitationsUrl, { signal: AbortSignal.timeout(timeout) });
    } catch (error) {
      // the http client may reject the error responses
      if (error?.status === 403) return [];
      throw error;
    }
    // the error interceptor may resolve the 403 response
    if (response.status === 403) return [];
    const data = await response.json();
    return data?.map(item => Habilitation.fromObject(item)) ?? [];
  }
}
