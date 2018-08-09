import { console as logger } from 'global';
import { observable, action, set } from 'mobx';
import pick from 'lodash.pick';

import { features } from './libs/key_events';
import checkIfMobileDevice from './libs/is_mobile_device';

const { userAgent } = global.window.navigator;
const isMobileDevice = checkIfMobileDevice(userAgent);

function ensureKind(stories, selectedKind) {
  if (stories.length === 0) return selectedKind;

  const found = stories.find(item => item.kind === selectedKind);
  if (found) return selectedKind;

  // if the selected kind is non-existant, select the first kind
  return stories[0].kind;
}

function ensureStory(stories, selectedKind, selectedStory) {
  if (!stories.length === 0) return selectedStory;

  const kindInfo = stories.find(item => item.kind === selectedKind);
  if (!kindInfo) return null;

  const found = kindInfo.stories.find(item => item === selectedStory);
  if (found) return found;

  // if the selected story is non-existant, select the first story
  return kindInfo.stories[0];
}

export function ensurePanel(panels, selectedPanel, currentPanel) {
  if (Object.keys(panels).indexOf(selectedPanel) >= 0) return selectedPanel;
  // if the selected panel is non-existant, select the current panel
  // and output to console all available panels
  logger.group('Available Panels ID:');
  Object.keys(panels).forEach(panelID => logger.log(`${panelID} (${panels[panelID].title})`));
  logger.groupEnd('Available Panels ID:');
  return currentPanel;
}

const createStore = ({ provider }) => {
  const store = observable(
    {
      stories: [],
      showShortcutsHelp: false,
      storyFilter: null,
      selectedAddonPanel: null,
      isMobileDevice,
      shortcutOptions: {
        goFullScreen: false,
        showStoriesPanel: !isMobileDevice,
        showAddonPanel: true,
        showSearchBox: false,
        addonPanelInRight: false,
        enableShortcuts: true,
      },
      uiOptions: {
        name: 'STORYBOOK',
        url: 'https://github.com/storybooks/storybook',
        sortStoriesByKind: false,
        hierarchySeparator: '/',
        hierarchyRootSeparator: null,
        sidebarAnimations: true,
        theme: null,
      },
      customQueryParams: {},

      get panels() {
        return provider.getPanels();
      },

      setOptions(options) {
        const { selectedAddonPanel, ...uiOptions } = options;
        const newOptions = pick(uiOptions, Object.keys(this.uiOptions));

        if (selectedAddonPanel) {
          this.selectedAddonPanel = ensurePanel(
            this.panels,
            selectedAddonPanel,
            this.selectedAddonPanel
          );
        }

        set(this.uiOptions, newOptions);
      },

      setShortcutsOptions(options) {
        set(this.shortcutOptions, pick(options, Object.keys(this.shortcutOptions)));
      },

      jumpToStory(direction) {
        const flatteredStories = [];
        let currentIndex = -1;

        this.stories.forEach(({ kind, stories }) => {
          stories.forEach(story => {
            flatteredStories.push({ kind, story });
            if (kind === this.selectedKind && story === this.selectedStory) {
              currentIndex = flatteredStories.length - 1;
            }
          });
        });

        const jumpedStory = flatteredStories[currentIndex + direction];
        if (!jumpedStory) {
          return;
        }

        this.selectedKind = jumpedStory.kind;
        this.selectedStory = jumpedStory.story;
      },

      handleEvent(event) {
        if (!this.shortcutOptions.enableShortcuts) return;

        switch (event) {
          case features.NEXT_STORY: {
            this.jumpToStory(1);
            break;
          }
          case features.PREV_STORY: {
            this.jumpToStory(-1);
            break;
          }
          case features.FULLSCREEN: {
            this.shortcutOptions.goFullScreen = !this.shortcutOptions.goFullScreen;
            break;
          }
          case features.ADDON_PANEL: {
            this.shortcutOptions.showAddonPanel = !this.shortcutOptions.showAddonPanel;
            break;
          }
          case features.STORIES_PANEL: {
            this.shortcutOptions.showStoriesPanel = !this.shortcutOptions.showStoriesPanel;
            break;
          }
          case features.SHOW_SEARCH: {
            this.toggleSearchBox();
            break;
          }
          case features.ADDON_PANEL_IN_RIGHT: {
            this.shortcutOptions.addonPanelInRight = !this.shortcutOptions.addonPanelInRight;
            break;
          }
          default:
            break;
        }
      },

      get urlState() {
        return {
          selectedKind: this.selectedKind,
          selectedStory: this.selectedStory,
          full: this.shortcutOptions.goFullScreen,
          addons: this.shortcutOptions.showAddonPanel,
          stories: this.shortcutOptions.showStoriesPanel,
          panelRight: this.shortcutOptions.addonPanelInRight,
          addonPanel: this.selectedAddonPanel,
          ...this.customQueryParams,
        };
      },

      get searchState() {
        return {
          selectedKind: this.selectedKind,
          selectedStory: this.selectedStory,
          full: Number(this.shortcutOptions.goFullScreen),
          addons: Number(this.shortcutOptions.showAddonPanel),
          stories: Number(this.shortcutOptions.showStoriesPanel),
          panelRight: Number(this.shortcutOptions.addonPanelInRight),
          addonPane: this.selectedAddonPanel,
          ...this.customQueryParams,
        };
      },

      toggleSearchBox() {
        this.shortcutOptions.showSearchBox = !this.shortcutOptions.showSearchBox;
      },

      /** UI actions */
      setStoryFilter(filter) {
        this.storyFilter = filter;
      },

      toggleShortcutsHelp() {
        this.showShortcutsHelp = !this.showShortcutsHelp;
      },

      selectAddonPanel(panelName) {
        this.selectedAddonPanel = panelName;
      },

      setStories(stories) {
        const selectedKind = ensureKind(stories, this.selectedKind);
        const currentSelectedStory = this.selectedKind === selectedKind ? this.selectedStory : null;
        const selectedStory = ensureStory(stories, selectedKind, currentSelectedStory);

        this.stories = stories;
        this.selectedStory = selectedStory;
        this.selectedKind = selectedKind;
      },

      selectStory(kind, story) {
        const selectedKind = ensureKind(this.stories, kind);
        const selectedStory = ensureStory(this.stories, selectedKind, story);

        this.selectedStory = selectedStory;
        this.selectedKind = selectedKind;
      },

      selectInCurrentKind(story) {
        const selectedStory = ensureStory(this.stories, this.selectedKind, story);

        this.selectedStory = selectedStory;
      },

      setQueryParams(customQueryParams) {
        set(
          this.customQueryParams,
          Object.keys(customQueryParams).reduce((acc, key) => {
            if (customQueryParams[key] !== null) acc[key] = customQueryParams[key];
            return acc;
          }, {})
        );
      },

      updateFromLocation(params) {
        const {
          selectedKind,
          selectedStory,
          full = 0,
          down = 1,
          addons = down,
          left = 1,
          stories = left,
          panelRight = 0,
          downPanel,
          addonPanel = downPanel,
          ...customQueryParams
        } = params;

        if (selectedKind) {
          this.selectedKind = selectedKind;
          this.selectedStory = selectedStory;
        }

        this.setShortcutsOptions({
          goFullScreen: Boolean(Number(full)),
          showAddonPanel: Boolean(Number(addons)),
          showStoriesPanel: Boolean(Number(stories)),
          addonPanelInRight: Boolean(Number(panelRight)),
        });

        if (addonPanel) {
          this.selectAddonPanel(addonPanel);
        }

        this.setQueryParams(customQueryParams);
      },
    },
    {
      setOptions: action,
      setShortcutsOptions: action,
      jumpToStory: action,
      handleEvent: action,
      toggleSearchBox: action,
      setStoryFilter: action,
      toggleShortcutsHelp: action,
      selectAddonPanel: action,
      setStories: action,
      selectStory: action,
      selectInCurrentKind: action,
      setQueryParams: action,
      updateFromLocation: action,
    }
  );

  return store;
};

export default createStore;