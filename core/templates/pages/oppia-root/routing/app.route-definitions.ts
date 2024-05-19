import {AppConstants} from 'app.constants';
import {IsLoggedInGuard} from 'pages/lightweight-oppia-root/routing/guards/is-logged-in.guard';
import {IsNewLessonPlayerGuard} from 'pages/exploration-player-page/new-lesson-player/lesson-player-flag.guard';

type RouteDefinition = {
  path: string;
  module: string;
  class: string;
  pathMatch?: 'full';
  canActivate?: any[];
};

// All paths must be defined in constants.ts file.
// Otherwise pages will have false 404 status code.
const routeDefinitions: RouteDefinition[] = [
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.ADMIN.ROUTE,
    module: 'pages/admin-page/admin-page.module',
    class: 'AdminPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.COLLECTION_EDITOR.ROUTE,
    module: 'pages/collection-editor-page/collection-editor-page.module',
    class: 'CollectionEditorPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.MODERATOR.ROUTE,
    module: 'pages/moderator-page/moderator-page.module',
    class: 'ModeratorPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.BLOG_ADMIN.ROUTE,
    module: 'pages/blog-admin-page/blog-admin-page.module',
    class: 'BlogAdminPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.BLOG_DASHBOARD.ROUTE,
    module: 'pages/blog-dashboard-page/blog-dashboard-page.module',
    class: 'BlogDashboardPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.EMAIL_DASHBOARD.ROUTE,
    module: 'pages/email-dashboard-pages/email-dashboard-page.module',
    class: 'EmailDashboardPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.DIAGNOSTIC_TEST_PLAYER
      .ROUTE,
    module:
      'pages/diagnostic-test-player-page/diagnostic-test-player-page.module',
    class: 'DiagnosticTestPlayerPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.CLASSROOM.ROUTE,
    pathMatch: 'full',
    module: 'pages/classroom-page/classroom-page.module',
    class: 'ClassroomPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.CURRICULUM_ADMIN.ROUTE,
    module: 'pages/classroom-admin-page/classroom-admin-page.module',
    class: 'ClassroomAdminPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LEARNER_DASHBOARD.ROUTE,
    module: 'pages/learner-dashboard-page/learner-dashboard-page.module',
    class: 'LearnerDashboardPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LEARNER_GROUP_EDITOR
      .ROUTE,
    module:
      'pages/learner-group-pages/edit-group/edit-learner-group-page.module',
    class: 'EditLearnerGroupPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.FACILITATOR_DASHBOARD
      .ROUTE,
    module:
      'pages/facilitator-dashboard-page/facilitator-dashboard-page.module',
    class: 'FacilitatorDashboardPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LEARNER_GROUP_CREATOR
      .ROUTE,
    module:
      'pages/learner-group-pages/create-group/create-learner-group-page.module',
    class: 'CreateLearnerGroupPage',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.ABOUT.ROUTE,
    module: 'pages/about-page/about-page.module',
    class: 'AboutPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.ABOUT_FOUNDATION.ROUTE,
    module: 'pages/about-foundation-page/about-foundation-page.module',
    class: 'AboutFoundationPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND
      .CONTRIBUTOR_DASHBOARD_ADMIN.ROUTE,
    module:
      'pages/contributor-dashboard-admin-page/contributor-dashboard-admin-page.module',
    class: 'ContributorDashboardAdminPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.EXPLORATION_PLAYER.ROUTE,
    module: 'pages/exploration-player-page/exploration-player-page.module',
    class: 'ExplorationPlayerPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.EXPLORATION_PLAYER_EMBED
      .ROUTE,
    module: 'pages/exploration-player-page/exploration-player-page.module',
    class: 'ExplorationPlayerPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.NEW_LESSON_PLAYER.ROUTE,
    module:
      'pages/exploration-player-page/new-lesson-player/lesson-player-page.module',
    class: 'NewLessonPlayerPageModule',
    canActivate: [IsNewLessonPlayerGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.ANDROID.ROUTE,
    module: 'pages/android-page/android-page.module',
    class: 'AndroidPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.DELETE_ACCOUNT.ROUTE,
    pathMatch: 'full',
    module: 'pages/delete-account-page/delete-account-page.module',
    class: 'DeleteAccountPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.PENDING_ACCOUNT_DELETION
      .ROUTE,
    module:
      'pages/pending-account-deletion-page/pending-account-deletion-page.module',
    class: 'PendingAccountDeletionPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.PREFERENCES.ROUTE,
    pathMatch: 'full',
    module: 'pages/preferences-page/preferences-page.module',
    class: 'PreferencesPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.FEEDBACK_UPDATES.ROUTE,
    pathMatch: 'full',
    module: 'pages/feedback-updates-page/feedback-updates-page.module',
    class: 'FeedbackUpdatesPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.PROFILE.ROUTE,
    module: 'pages/profile-page/profile-page.module',
    class: 'ProfilePageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.RELEASE_COORDINATOR_PAGE
      .ROUTE,
    module: 'pages/release-coordinator-page/release-coordinator-page.module',
    class: 'ReleaseCoordinatorPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LIBRARY_INDEX.ROUTE,
    pathMatch: 'full',
    module: 'pages/library-page/library-page.module',
    class: 'LibraryPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LIBRARY_SEARCH.ROUTE,
    pathMatch: 'full',
    module: 'pages/library-page/library-page.module',
    class: 'LibraryPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LIBRARY_RECENTLY_PUBLISHED
      .ROUTE,
    pathMatch: 'full',
    module: 'pages/library-page/library-page.module',
    class: 'LibraryPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LIBRARY_TOP_RATED.ROUTE,
    pathMatch: 'full',
    module: 'pages/library-page/library-page.module',
    class: 'LibraryPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.STORY_VIEWER.ROUTE,
    pathMatch: 'full',
    module: 'pages/story-viewer-page/story-viewer-page.module',
    class: 'StoryViewerPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.CONTACT.ROUTE,
    module: 'pages/contact-page/contact-page.module',
    class: 'ContactPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.DONATE.ROUTE,
    module: 'pages/donate-page/donate-page.module',
    class: 'DonatePageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.GET_STARTED.ROUTE,
    module: 'pages/get-started-page/get-started-page.module',
    class: 'GetStartedPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LICENSE.ROUTE,
    module: 'pages/license-page/license.module',
    class: 'LicensePageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LOGIN.ROUTE,
    module: 'pages/login-page/login-page.module',
    class: 'LoginPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LOGOUT.ROUTE,
    module: 'pages/logout-page/logout-page.module',
    class: 'LogoutPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.PARTNERSHIPS.ROUTE,
    module: 'pages/partnerships-page/partnerships-page.module',
    class: 'PartnershipsPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.PLAYBOOK.ROUTE,
    module: 'pages/participation-playbook/playbook.module',
    class: 'PlaybookPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.PRIVACY.ROUTE,
    module: 'pages/privacy-page/privacy-page.module',
    class: 'PrivacyPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.SIGNUP.ROUTE,
    module: 'pages/signup-page/signup-page.module',
    class: 'SignupPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.TEACH.ROUTE,
    module: 'pages/teach-page/teach-page.module',
    class: 'TeachPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.TERMS.ROUTE,
    module: 'pages/terms-page/terms-page.module',
    class: 'TermsPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.THANKS.ROUTE,
    module: 'pages/thanks-page/thanks-page.module',
    class: 'ThanksPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.VOLUNTEER.ROUTE,
    module: 'pages/volunteer-page/volunteer-page.module',
    class: 'VolunteerPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.LEARNER_GROUP_VIEWER
      .ROUTE,
    pathMatch: 'full',
    module:
      'pages/learner-group-pages/view-group/view-learner-group-page.module',
    class: 'ViewLearnerGroupPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.BLOG_HOMEPAGE.ROUTE,
    pathMatch: 'full',
    module: 'pages/blog-home-page/blog-home-page.module',
    class: 'BlogHomePageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.BLOG_HOMEPAGE_SEARCH
      .ROUTE,
    pathMatch: 'full',
    module: 'pages/blog-home-page/blog-home-page.module',
    class: 'BlogHomePageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.BLOG_AUTHOR_PROFILE_PAGE
      .ROUTE,
    pathMatch: 'full',
    module: 'pages/blog-author-profile-page/blog-author-profile-page.module',
    class: 'BlogAuthorProfilePageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.BLOG_POST_PAGE.ROUTE,
    pathMatch: 'full',
    module: 'pages/blog-post-page/blog-post-page.module',
    class: 'BlogPostPageModule',
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.VOICEOVER_ADMIN.ROUTE,
    module: 'pages/voiceover-admin-page/voiceover-admin-page.module',
    class: 'VoiceoverAdminPageModule',
    canActivate: [IsLoggedInGuard],
  },
  {
    path: AppConstants.PAGES_REGISTERED_WITH_FRONTEND.COLLECTION_PLAYER.ROUTE,
    pathMatch: 'full',
    module: 'pages/collection-player-page/collection-player-page.module',
    class: 'CollectionPlayerPageModule',
  },
];

// Register stewards landing pages.
for (let i = 0; i < AppConstants.STEWARDS_LANDING_PAGE.ROUTES.length; i++) {
  // Redirect old stewards landing pages to volunteer page.
  routeDefinitions.push({
    path: AppConstants.STEWARDS_LANDING_PAGE.ROUTES[i],
    module: 'pages/volunteer-page/volunteer-page.module',
    class: 'VolunteerPageModule',
  });
}

// Register all routes for topic landing page.
for (let key in AppConstants.AVAILABLE_LANDING_PAGES) {
  for (let i = 0; i < AppConstants.AVAILABLE_LANDING_PAGES[key].length; i++) {
    routeDefinitions.push({
      path: key + '/' + AppConstants.AVAILABLE_LANDING_PAGES[key][i],
      module:
        'pages/landing-pages/topic-landing-page/topic-landing-page.module',
      class: 'TopicLandingPageModule',
    });
  }
}

// Error routes.
routeDefinitions.push(
  // Route to register all the custom error pages on oppia.
  {
    path: `${AppConstants.PAGES_REGISTERED_WITH_FRONTEND.ERROR.ROUTE}/:status_code`,
    module: 'pages/error-pages/error-page.module',
    class: 'ErrorPageModule',
  },
  // '**' wildcard route must be kept at the end,as it can override all other
  // routes.
  // Add error page for not found routes.
  {
    path: '**',
    module: 'pages/error-pages/error-page.module',
    class: 'ErrorPageModule',
  }
);

export {routeDefinitions};
