import { StageComponent } from 'aurelia-testing';
import { bootstrap } from 'aurelia-bootstrapper';
import { Authorizer } from '../../../src/core/authorizer';

describe('authorization-status element and able value converter', () => {
  let component;

  afterEach(() => {
    component?.dispose();
    component = undefined;
  });

  test('displays the status message and the allowed actions', async () => {
    const authorizer = {
      message: 'Vérification de vos droits...',
      alertType: 'info',
      can: (action, subject) => action === 'lire' && subject === 'document'
    };
    component = StageComponent.withResources([
      'elements/authorization-status/authorization-status',
      'value-converters/able'
    ])
      .inView(
        `<authorization-status></authorization-status>
        <span id="lire" if.bind="'lire' | able: 'document'">lire</span>
        <span id="gerer" if.bind="'gerer' | able: 'document'">gerer</span>`
      )
      .boundTo({});
    component.bootstrap(aurelia => {
      aurelia.use.standardConfiguration();
      aurelia.container.registerInstance(Authorizer, authorizer);
    });
    await component.create(bootstrap);
    const alert = component.element.querySelector('.alert');
    expect(alert.classList).toContain('alert-info');
    expect(alert.textContent.trim()).toBe('Vérification de vos droits...');
    expect(document.querySelector('#lire')).not.toBeNull();
    expect(document.querySelector('#gerer')).toBeNull();
  });
});
