# Copyright 2024 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS-IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A script to check which test suites to run in the CI."""

from __future__ import annotations

import json
import os
import argparse

import subprocess
from typing import Optional, TypedDict, List, Final

from scripts import generate_dependency_graph

_PARSER: Final = argparse.ArgumentParser(
    description=""""""
)

_PARSER.add_argument(
    '--github_head_ref', type=str, required=True,
)

_PARSER.add_argument(
    '--github_base_ref', type=str, required=True,
)

ENVIRONMENT_E2E_TEST_SUITES_OUTPUT = 'E2E_TEST_SUITES_TO_RUN'
ENVIRONMENT_ACCEPTANCE_TEST_SUITES_OUTPUT = 'ACCEPTANCE_TEST_SUITES_TO_RUN'
ENVIRONMENT_LIGHTHOUSE_PERFORMANCE_TEST_SUITES_OUTPUT = 'LIGHTHOUSE_PERFORMANCE_TEST_SUITES_TO_RUN'
ENVIRONMENT_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES_OUTPUT = 'LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES_TO_RUN'

FILE_DIRECTORY: Final = os.path.abspath(os.path.dirname(__file__))
OPPIA_DIRECTORY: Final = os.path.join(FILE_DIRECTORY, os.pardir)
DEPEDENCY_GRAPH_PATH = os.path.join(OPPIA_DIRECTORY, 'dependency-graph.json')

class TestSuiteDict(TypedDict):
    suite_name: str
    module_path: Optional[str] = None
    
class TestSuitesByTypeMappingDict(TypedDict):
    e2e: List[TestSuiteDict]
    acceptance: List[TestSuiteDict]
    lighthouse_performance: List[TestSuiteDict]
    lighthouse_accessibility: List[TestSuiteDict]
    
ALL_E2E_TEST_SUITES = [
    TestSuiteDict(suite_name='accessibility'),
    TestSuiteDict(suite_name='additionalEditorFeatures'),
    TestSuiteDict(suite_name='additionalEditorFeaturesModals'),
    TestSuiteDict(suite_name='additionalPlayerFeatures'),
    TestSuiteDict(suite_name='adminPage'),
    TestSuiteDict(suite_name='blogDashboard'),
    TestSuiteDict(suite_name='blog'),
    TestSuiteDict(suite_name='checkpointFeatures'),
    TestSuiteDict(suite_name='classroomPage'),
    TestSuiteDict(suite_name='classroomPageFileUploadFeatures'),
    TestSuiteDict(suite_name='collections'),
    TestSuiteDict(suite_name='contributorDashboard'),
    TestSuiteDict(suite_name='contributorAdminDashboard'),
    TestSuiteDict(suite_name='coreEditorAndPlayerFeatures'),
    TestSuiteDict(suite_name='creatorDashboard'),
    TestSuiteDict(suite_name='embedding'),
    TestSuiteDict(suite_name='explorationFeedbackTab'),
    TestSuiteDict(suite_name='explorationImprovementsTab'),
    TestSuiteDict(suite_name='explorationHistoryTab'),
    TestSuiteDict(suite_name='explorationStatisticsTab'),
    TestSuiteDict(suite_name='explorationTranslationTab'),
    TestSuiteDict(suite_name='extensions'),
    TestSuiteDict(suite_name='featureGating'),
    TestSuiteDict(suite_name='feedbackUpdates'),
    TestSuiteDict(suite_name='fileUploadExtensions'),
    TestSuiteDict(suite_name='fileUploadFeatures'),
    TestSuiteDict(suite_name='learner'),
    TestSuiteDict(suite_name='learnerDashboard'),
    TestSuiteDict(suite_name='library'),
    TestSuiteDict(suite_name='navigation'),
    TestSuiteDict(suite_name='playVoiceovers'),
    TestSuiteDict(suite_name='preferences'),
    TestSuiteDict(suite_name='profileFeatures'),
    TestSuiteDict(suite_name='profileMenu'),
    TestSuiteDict(suite_name='publication'),
    TestSuiteDict(suite_name='skillEditor'),
    TestSuiteDict(suite_name='subscriptions'),
    TestSuiteDict(suite_name='topicsAndSkillsDashboard'),
    TestSuiteDict(suite_name='topicAndStoryEditor'),
    TestSuiteDict(suite_name='topicAndStoryEditorFileUploadFeatures'),
    TestSuiteDict(suite_name='topicAndStoryViewer'),
    TestSuiteDict(suite_name='users'),
    TestSuiteDict(suite_name='wipeout')
]

ALL_ACCEPTANCE_TEST_SUITES = [
    TestSuiteDict(suite_name='blog-admin-tests/assign-roles-to-users-and-change-tag-properties',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/blog-admin-tests/assign-roles-to-users-and-change-tag-properties.spec.ts'),
    TestSuiteDict(suite_name='blog-editor-tests/try-to-publish-a-duplicate-blog-post-and-get-blocked',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/blog-editor-tests/try-to-publish-a-duplicate-blog-post-and-get-blocked.spec.ts'),
    TestSuiteDict(suite_name='curriculum-admin-tests/create-and-publish-topics-and-stories',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/curriculum-admin-tests/create-and-publish-topics-and-stories.spec.ts'),
    TestSuiteDict(suite_name='exploration-editor-tests/load-complete-and-restart-exploration-preview',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/exploration-editor-tests/load-complete-and-restart-exploration-preview.spec.ts'),
    TestSuiteDict(suite_name='exploration-editor-tests/create-exploration-and-change-basic-settings',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/exploration-editor-tests/create-exploration-and-change-basic-settings.spec.ts'),
    TestSuiteDict(suite_name='logged-in-user-tests/click-all-buttons-on-about-page',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/logged-in-user-tests/click-all-buttons-on-about-page.spec.ts'),
    TestSuiteDict(suite_name='logged-in-user-tests/click-all-buttons-on-about-foundation-page',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/logged-in-user-tests/click-all-buttons-on-about-foundation-page.spec.ts'),
    TestSuiteDict(suite_name='logged-in-user-tests/click-all-buttons-on-thanks-for-donating-page',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/logged-in-user-tests/click-all-buttons-on-thanks-for-donating-page.spec.ts'),
    TestSuiteDict(suite_name='logged-in-user-tests/click-all-buttons-on-navbar',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/logged-in-user-tests/click-all-buttons-on-navbar.spec.ts'),
    TestSuiteDict(suite_name='logged-in-user-tests/click-all-links-in-about-oppia-footer',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/logged-in-user-tests/click-all-links-in-about-oppia-footer.spec.ts'),
    TestSuiteDict(suite_name='logged-in-user-tests/click-all-links-on-get-started-page',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/logged-in-user-tests/click-all-links-on-get-started-page.spec.ts'),
    TestSuiteDict(suite_name='practice-question-admin-tests/add-and-remove-contribution-rights',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/practice-question-admin-tests/add-and-remove-contribution-rights.spec.ts'),
    TestSuiteDict(suite_name='translation-admin-tests/add-translation-rights',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/translation-admin-tests/add-translation-rights.spec.ts'),
    TestSuiteDict(suite_name='translation-admin-tests/remove-translation-rights',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/translation-admin-tests/remove-translation-rights.spec.ts'),
    TestSuiteDict(suite_name='voiceover-admin-tests/add-voiceover-artist-to-an-exploration',
                  module_path='core/tests/puppeteer-acceptance-tests/spec/voiceover-admin-tests/add-voiceover-artist-to-an-exploration.spec.ts'),
]

ALL_LIGHTHOUSE_PERFORMANCE_TEST_SUITES = [
    TestSuiteDict(suite_name='1', module_path='.lighthouserc-1.js'),
    TestSuiteDict(suite_name='2', module_path='.lighthouserc-2.js'),
]

ALL_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES = [
    TestSuiteDict(suite_name='1', module_path='.lighthouserc-accessibility-1.js'),
    TestSuiteDict(suite_name='2', module_path='.lighthouserc-accessibility-2.js'),
]

def git_diff_name_status(
    left: str, right: str
) -> List[str]:
    git_cmd = ['git', 'diff', '--name-status']
    git_cmd.extend([left, right])
    git_cmd.append('--')
    
    task = subprocess.Popen(
        git_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = task.communicate()
    if not err:
        file_list = []
        for line in out.splitlines():
            file_list.append(line[1:].decode('utf-8').strip())
        return file_list
    else:
        raise ValueError(err)


def does_diff_include_python_files(diff_files: List[str]) -> bool:
    for file_path in diff_files:
        if file_path.endswith('.py'):
            return True
    return False


def output_test_suites_to_run_to_github_workflow(
    output_variable: str,
    test_suites_to_run: List[TestSuiteDict]
) -> None:
    formatted_test_suites_to_run = [
        {
            'name': test_suite.get('suite_name')
        } for test_suite in test_suites_to_run
    ]
    test_suites_to_run_count = len(test_suites_to_run)
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as o:
        print(f'{output_variable}={json.dumps(formatted_test_suites_to_run)}', file=o)
        print(f'{output_variable}_COUNT={test_suites_to_run_count}', file=o)
        

def get_test_suites_to_modules_mapping_by_file(
    root_directory: str,
    file_path: str,
    all_test_suites: List[TestSuiteDict]
) -> dict[str, List[str]]:
    test_suites_to_modules_mapping = {}
    with open(os.path.join(root_directory, file_path), 'r', encoding='utf-8') as f:
        modules = f.read().splitlines()
        file_path_without_extension = os.path.splitext(file_path)[0]
        test_suite = next(
            (test_suite for test_suite in all_test_suites if
                test_suite.get('suite_name') == file_path_without_extension),
            None
        )
        if test_suite is not None:
            test_suites_to_modules_mapping[test_suite.get('suite_name')] = modules

    return test_suites_to_modules_mapping
 
        
def get_test_suites_to_modules_mapping_by_type(
    modules_mapping_directory: str,
    all_test_suites: List[TestSuiteDict]
) -> dict[str, List[str]]:
    test_suites_to_modules_mapping = {}
    for root, directories, files in os.walk(modules_mapping_directory):
        for file_path in files:
            test_suites_to_modules_mapping.update(
                get_test_suites_to_modules_mapping_by_file(
                    root, file_path, all_test_suites))
        for directory in directories:
            for _, _, files in os.walk(os.path.join(root, directory)):
                for file_path in files:
                    test_suites_to_modules_mapping.update(
                        get_test_suites_to_modules_mapping_by_file(
                            root, os.path.join(directory, file_path), all_test_suites))
                
    return test_suites_to_modules_mapping


def get_test_suites_affected_by_module(
    module: str,
    test_suites_to_modules_mapping: dict[str, List[str]],
    all_test_suites: List[TestSuiteDict]
) -> List[TestSuiteDict]:
    affected_tests: List[TestSuiteDict] = []
    # If any of the test suites are not in the mapping, we should run them.
    for test_suite in all_test_suites:
        if test_suite.get('suite_name') not in test_suites_to_modules_mapping.keys():
            affected_tests.append(test_suite)
    for test_suite_name, modules in test_suites_to_modules_mapping.items():
        test_suite = next(
            (test_suite for test_suite in all_test_suites if
                test_suite.get('suite_name') == test_suite_name),
            None
        )
        if module in modules:
            affected_tests.append(test_suite)
        if module == test_suite.module_path:
            affected_tests.append(test_suite)

    distinct_affected_tests = []
    for test_suite in affected_tests:
        if test_suite not in distinct_affected_tests:
            distinct_affected_tests.append(test_suite)
            
    return distinct_affected_tests
        
def collect_ci_test_suites_to_run(
    modified_files: List[str],
    dependency_graph: dict
) -> TestSuitesByTypeMappingDict:
    modified_modules = []
    for file_path in modified_files:
        if file_path not in dependency_graph:
            return {
                'e2e': ALL_E2E_TEST_SUITES,
                'acceptance': ALL_ACCEPTANCE_TEST_SUITES,
                'lighthouse_performance': ALL_LIGHTHOUSE_PERFORMANCE_TEST_SUITES,
                'lighthouse_accessibility': ALL_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES
            }
        file_modules = dependency_graph[file_path]
        for file_module in file_modules:
            if file_module not in modified_modules:
                modified_modules.append(file_module)

    # We are running all E2E tests regardless of the modified files. Remove this
    # after the E2E tests are removed. 
    e2e_test_suites = ALL_E2E_TEST_SUITES
    acceptance_test_suites: List[TestSuiteDict] = []
    lighthouse_performance_test_suites: List[TestSuiteDict] = []
    lighthouse_accessibility_test_suites: List[TestSuiteDict] = []

    acceptance_test_suites_to_modules_mapping = get_test_suites_to_modules_mapping_by_type(
        os.path.join(OPPIA_DIRECTORY, 'core/tests/modules-mapping/acceptance'), ALL_ACCEPTANCE_TEST_SUITES)
    
    lighthouse_performance_test_suites_to_modules_mapping = get_test_suites_to_modules_mapping_by_type(
        os.path.join(OPPIA_DIRECTORY, 'core/tests/modules-mapping/lighthouse-performance'), ALL_LIGHTHOUSE_PERFORMANCE_TEST_SUITES)
    
    lighthouse_accessibility_test_suites_to_modules_mapping = get_test_suites_to_modules_mapping_by_type(
        os.path.join(OPPIA_DIRECTORY, 'core/tests/modules-mapping/lighthouse-accessibility'), ALL_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES)
    
    for module in modified_modules:
        acceptance_test_suites.extend(
            get_test_suites_affected_by_module(
                module, acceptance_test_suites_to_modules_mapping, ALL_ACCEPTANCE_TEST_SUITES))
        lighthouse_performance_test_suites.extend(
            get_test_suites_affected_by_module(
                module, lighthouse_performance_test_suites_to_modules_mapping, ALL_LIGHTHOUSE_PERFORMANCE_TEST_SUITES))
        lighthouse_accessibility_test_suites.extend(
            get_test_suites_affected_by_module(
                module, lighthouse_accessibility_test_suites_to_modules_mapping, ALL_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES))
        
    return {
        'e2e': e2e_test_suites,
        'acceptance': acceptance_test_suites,
        'lighthouse_performance': lighthouse_performance_test_suites,
        'lighthouse_accessibility': lighthouse_accessibility_test_suites
    }


def main(args: Optional[list[str]] = None) -> None:
    """Outputs the test suites to run in the CI."""
    parsed_args = _PARSER.parse_args(args=args)

    modified_files = git_diff_name_status(
        parsed_args.github_base_ref, parsed_args.github_head_ref)

    if does_diff_include_python_files(modified_files):
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_E2E_TEST_SUITES_OUTPUT, ALL_E2E_TEST_SUITES)
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_ACCEPTANCE_TEST_SUITES_OUTPUT, ALL_ACCEPTANCE_TEST_SUITES)
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_LIGHTHOUSE_PERFORMANCE_TEST_SUITES_OUTPUT, ALL_LIGHTHOUSE_PERFORMANCE_TEST_SUITES),
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES_OUTPUT, ALL_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES)
        return
    
    generate_dependency_graph.main()

    with open(DEPEDENCY_GRAPH_PATH, 'r', encoding='utf-8') as f:
        dependency_graph = json.load(f)
        ci_test_suites_to_run = collect_ci_test_suites_to_run(modified_files, dependency_graph)

        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_E2E_TEST_SUITES_OUTPUT, ci_test_suites_to_run['e2e'])
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_ACCEPTANCE_TEST_SUITES_OUTPUT, ci_test_suites_to_run['acceptance'])
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_LIGHTHOUSE_PERFORMANCE_TEST_SUITES_OUTPUT, ci_test_suites_to_run['lighthouse_performance'])
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_LIGHTHOUSE_ACCESSIBILITY_TEST_SUITES_OUTPUT, ci_test_suites_to_run['lighthouse_accessibility'])


# The 'no coverage' pragma is used as this line is un-testable. This is because
# it will only be called when check_e2e_tests_are_captured_in_ci.py
# is used as a script.
if __name__ == '__main__':  # pragma: no cover
    main()