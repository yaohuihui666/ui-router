/**
 * # UI-Router for Angular 2
 *
 * For the quick start repository, please see http://github.com/ui-router/quickstart-ng2
 * 
 * Getting started:
 * 
 * - Use npm. Add a dependency on latest `ui-router-ng2`
 * - Import UI-Router classes directly from `"ui-router-ng2"`
 *
 * ```js
 * import {StateRegistry} from "ui-router-ng2";
 * ```
 *
 * - When defining a component, add the [[UIROUTER_DIRECTIVES]] to `directives:` array.
 * - Either bootstrap a [[UIView]] component, or add a `<ui-view></ui-view>` viewport to your root component.
 * - Create application states (as defined by [[Ng2StateDeclaration]]) which will fill in the viewports.
 * - Create a [[UIRouterConfig]], and register your states in the [[UIRouterConfig.configure]] function.
 *
 * ```js
 * import {UIRouter} from "ui-router-ng2";
 * import {INITIAL_STATES} from "./app.states";
 * @ Injectable()
 * export class MyUIRouterConfig {
 *   configure(uiRouter: UIRouter) {
 *     INITIAL_STATES.forEach(function(state) {
 *       uiRouter.stateRegistry.register(state));
 *     });
 *   }
 * }
 * ```
 *
 * - When bootstrapping: include the [[UIROUTER_PROVIDERS]] and define a provider for your [[UIRouterConfig]]
 *
 * ```js
 * import {provide} from "@angular/core";
 * import {bootstrap} from 'angular2/platform/browser';
 * import {UIRouterConfig, UIView, UIROUTER_PROVIDERS} from "ui-router-ng2";
 * import {MyUIRouterConfig} from "./router.config";
 *
 * bootstrap(UIView, [
 *     ...UIROUTER_PROVIDERS,
 *     provide(UIRouterConfig, { useClass: MyUIRouterConfig })
 * ]);
 * ```
 *
 * @preferred @module ng2
 */ /** */
import {Injector, OpaqueToken} from "@angular/core";
import {UIRouter} from "../router";
import {PathNode} from "../path/node";
import {StateRegistry} from "../state/stateRegistry";
import {StateService} from "../state/stateService";
import {TransitionService} from "../transition/transitionService";
import {UrlMatcherFactory} from "../url/urlMatcherFactory";
import {UrlRouter} from "../url/urlRouter";
import {ViewService} from "../view/view";
import {UIView, ParentUIViewInject} from "./directives/uiView";
import {ng2ViewsBuilder, Ng2ViewConfig} from "./statebuilders/views";
import {Ng2ViewDeclaration, NG2_INJECTOR_TOKEN} from "./interface";
import {UIRouterConfig} from "./uiRouterConfig";
import {Globals} from "../globals";
import {UIRouterLocation} from "./location";
import {services} from "../common/coreservices";
import {ProviderLike} from "../state/interface";
import {Resolvable} from "../resolve/resolvable";
import {ngModuleResolvablesBuilder} from "./statebuilders/lazyLoadNgModuleResolvable";
import {flattenR} from "../common/common";
import {UIROUTER_STATES_TOKEN} from "./uiRouterNgModule";

export const NG1_UIROUTER_TOKEN = new OpaqueToken("$uiRouter");

/**
 * This is a provider factory for a UIRouter instance which is configured for Angular 2
 */
let uiRouterFactory = (injector: Injector) => {
  // ----------------- ng1-to-ng2 short circuit ------
  // Before creating a UIRouter instance, see if there is
  // already one created (from ng1-to-ng2 as NG1_UIROUTER_TOKEN)
  let $uiRouter = injector.get(NG1_UIROUTER_TOKEN, null);
  if ($uiRouter) return $uiRouter;


  // ----------------- Get DI dependencies -----------
  // Get the DI deps manually from the injector
  // (no UIRouterConfig is provided when in hybrid mode)
  let routerConfig: UIRouterConfig = injector.get(UIRouterConfig);
  let location: UIRouterLocation = injector.get(UIRouterLocation);


  // ----------------- Monkey Patches ----------------
  // Monkey patch the services.$injector to the ng2 Injector
  services.$injector.get = injector.get.bind(injector);

  // Monkey patch the services.$location with ng2 Location implementation
  location.init();


  // ----------------- Create router -----------------
  // Create a new ng2 UIRouter and configure it for ng2
  let router = new UIRouter();
  let registry = router.stateRegistry;

  // ----------------- Configure for ng2 -------------
  // Apply ng2 ui-view handling code
  router.viewService.viewConfigFactory("ng2", (path: PathNode[], config: Ng2ViewDeclaration) => new Ng2ViewConfig(path, config));
  registry.decorator('views', ng2ViewsBuilder);

  // Apply statebuilder decorator for ng2 NgModule registration
  registry.stateQueue.flush(router.stateService);
  registry.decorator('resolvables', ngModuleResolvablesBuilder);

  // Prep the tree of NgModule by placing the root NgModule's Injector on the root state.
  let ng2InjectorResolvable = Resolvable.fromData(NG2_INJECTOR_TOKEN, injector);
  registry.root().resolvables.push(ng2InjectorResolvable);


  // ----------------- Initialize router -------------
  // Allow states to be registered
  registry.stateQueue.autoFlush(router.stateService);

  setTimeout(() => {
    // Let the app apply custom configuration...
    // (global transition hooks, deferIntercept, otherwise, etc)
    routerConfig.configure(router);

    // Register the states from the root NgModule [[UIRouterModule]]
    let states = (injector.get(UIROUTER_STATES_TOKEN) || []).reduce(flattenR, []);
    states.forEach(state => registry.register(state));

    // Start monitoring the URL
    if (!router.urlRouterProvider.interceptDeferred) {
      router.urlRouter.listen();
      router.urlRouter.sync();
    }
  });

  return router;
};

/**
 * The UI-Router providers, for use in your application bootstrap
 *
 * @deprecated use [[UIRouterModule]]
 */
export const UIROUTER_PROVIDERS: ProviderLike[] = [
  { provide: UIRouterLocation, useClass: UIRouterLocation },
  { provide: UIRouter, useFactory: uiRouterFactory, deps: [Injector] },

  { provide: StateService,      useFactory: (r: UIRouter) => r.stateService     , deps: [UIRouter]},
  { provide: TransitionService, useFactory: (r: UIRouter) => r.transitionService, deps: [UIRouter]},
  { provide: UrlMatcherFactory, useFactory: (r: UIRouter) => r.urlMatcherFactory, deps: [UIRouter]},
  { provide: UrlRouter,         useFactory: (r: UIRouter) => r.urlRouter        , deps: [UIRouter]},
  { provide: ViewService,       useFactory: (r: UIRouter) => r.viewService      , deps: [UIRouter]},
  { provide: StateRegistry,     useFactory: (r: UIRouter) => r.stateRegistry    , deps: [UIRouter]},
  { provide: Globals,           useFactory: (r: UIRouter) => r.globals          , deps: [UIRouter]},

  { provide: UIView.PARENT_INJECT, useFactory: (r: StateRegistry) => { return { fqn: null, context: r.root() } as ParentUIViewInject }, deps: [StateRegistry]}
];