import { inject } from 'aurelia-framework';
import { Authorizer, authorizationEvent } from '../core/authorizer';

/**
 * Implements the **`able` value converter** that tells whether the user can perform an action on a subject.
 * The bindings are refreshed when the habilitations change.
 * @example
 * <button if.bind="'modifier' | able: 'document'">Modifier</button>
 * @category value-converter
 */
@inject(Authorizer)
export class AbleValueConverter {
  /** Binding signals refreshing the conversion. @type {string[]} */ signals = [authorizationEvent.changed];

  /**
   * Creates an instance of the value converter.
   * @param {Authorizer} authorizer authorization system
   */
  constructor(authorizer) {
    this._authorizer = authorizer;
  }

  /**
   * Can the user perform the specified action on the specified subject?
   * @param {string} action action on the subject
   * @param {string} subject protected resource
   * @returns {boolean} true when allowed
   */
  toView(action, subject) {
    return this._authorizer.can(action, subject);
  }
}
