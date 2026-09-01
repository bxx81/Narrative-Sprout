export const ROUTES = {
  HOME: "/",
  SETUP: "/setup",
  STARTING: "/setup/starting",
  LOAD: "/load",
  HISTORY: "/history",
  CHRONICLE: "/chronicle",
  SETTINGS: "/settings",
  PLAY: "/play",
  DELETION_COMPLETE: "/deletion_complete",
} as const;

export function isNeedPadding(path: string): boolean {
  switch (path) {
    case ROUTES.PLAY:
    case ROUTES.STARTING:
    case ROUTES.DELETION_COMPLETE:
      return false;
    default:
      return true;
  }
}

export function isVisibleSettingsButton(path: string): boolean {
  switch (path) {
    case ROUTES.SETTINGS:
    case ROUTES.DELETION_COMPLETE:
      return false;
    default:
      return true;
  }
}
