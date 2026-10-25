export class Page {
  activate(_parameters, routeConfig) {
    this.title = routeConfig.title;
  }

  // the routes share this view-model
  determineActivationStrategy() {
    return 'replace';
  }
}
