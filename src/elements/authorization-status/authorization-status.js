import { inject } from 'aurelia-framework';
import { Authorizer } from '../../core/authorizer';

/**
 * Implements the **`authorization-status` custom element** that displays the status of the authorization process
 * (loading, error, unauthorized) in a bootstrap alert. Nothing is displayed when the user is authorized.
 * @example
 * <authorization-status></authorization-status>
 * @category element
 */
@inject(Authorizer)
export class AuthorizationStatusCustomElement {
  /** Authorization system. @type {Authorizer} */ authorizer;

  /**
   * Creates an instance of the `authorization-status` custom element.
   * @param {Authorizer} authorizer authorization system
   */
  constructor(authorizer) {
    this.authorizer = authorizer;
  }
}
