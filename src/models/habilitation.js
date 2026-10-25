/**
 * Implements the **Habilitation** model: an action granted to the user on a subject (protected resource).
 * @category public
 */
export class Habilitation {
  /** Action allowed on the subject. @type {string} */ action;
  /** Protected resource. @type {string} */ subject;

  /**
   * Creates an habilitation from a raw object.
   * @param {{ action: string, subject: string }} item raw habilitation, typically returned by the api
   * @returns {Habilitation} habilitation
   */
  static fromObject({ action, subject }) {
    return Object.assign(new Habilitation(), { action, subject });
  }
}
