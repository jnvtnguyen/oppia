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
ENVIRONMENT_LIGHTHOUSE_TEST_SUITES_OUTPUT = 'LIGHTHOUSE_TEST_SUITES_TO_RUN'
ENVIRONMENT_TOTAL_TEST_SUITE_COUNT_OUTPUT = 'TOTAL_TEST_SUITE_COUNT'

FILE_DIRECTORY: Final = os.path.abspath(os.path.dirname(__file__))
OPPIA_DIRECTORY: Final = os.path.join(FILE_DIRECTORY, os.pardir)
DEPEDENCY_GRAPH_PATH = os.path.join(OPPIA_DIRECTORY, 'dependency-graph.json')

class TestSuiteDict(TypedDict):
    name: str
    
class TestTypeSuiteMappingDict(TypedDict):
    e2e: List[TestSuiteDict]
    acceptance: List[TestSuiteDict]
    lighthouse: List[TestSuiteDict]
    
ALL_E2E_TEST_SUITES = [
    TestSuiteDict(name='accessibility'),
    TestSuiteDict(name='additionalEditorFeatures'),
    TestSuiteDict(name='additionalEditorFeaturesModals'),
    TestSuiteDict(name='additionalPlayerFeatures'),
    TestSuiteDict(name='adminPage'),
    TestSuiteDict(name='blogDashboard'),
    TestSuiteDict(name='blog'),
    TestSuiteDict(name='checkpointFeatures'),
    TestSuiteDict(name='classroomPage'),
    TestSuiteDict(name='classroomPageFileUploadFeatures'),
    TestSuiteDict(name='collections'),
    TestSuiteDict(name='contributorDashboard'),
    TestSuiteDict(name='contributorAdminDashboard'),
    TestSuiteDict(name='coreEditorAndPlayerFeatures'),
    TestSuiteDict(name='creatorDashboard'),
    TestSuiteDict(name='embedding'),
    TestSuiteDict(name='explorationFeedbackTab'),
    TestSuiteDict(name='explorationImprovementsTab'),
    TestSuiteDict(name='explorationHistoryTab'),
    TestSuiteDict(name='explorationStatisticsTab'),
    TestSuiteDict(name='explorationTranslationTab'),
    TestSuiteDict(name='extensions'),
    TestSuiteDict(name='featureGating'),
    TestSuiteDict(name='feedbackUpdates'),
    TestSuiteDict(name='fileUploadExtensions'),
    TestSuiteDict(name='fileUploadFeatures'),
    TestSuiteDict(name='learner'),
    TestSuiteDict(name='learnerDashboard'),
    TestSuiteDict(name='library'),
    TestSuiteDict(name='navigation'),
    TestSuiteDict(name='playVoiceovers'),
    TestSuiteDict(name='preferences'),
    TestSuiteDict(name='profileFeatures'),
    TestSuiteDict(name='profileMenu'),
    TestSuiteDict(name='publication'),
    TestSuiteDict(name='skillEditor'),
    TestSuiteDict(name='subscriptions'),
    TestSuiteDict(name='topicsAndSkillsDashboard'),
    TestSuiteDict(name='topicAndStoryEditor'),
    TestSuiteDict(name='topicAndStoryEditorFileUploadFeatures'),
    TestSuiteDict(name='topicAndStoryViewer'),
    TestSuiteDict(name='users'),
    TestSuiteDict(name='wipeout')
]

ALL_ACCEPTANCE_TEST_SUITES = [
    TestSuiteDict(name='blog-admin-tests/assign-roles-to-users-and-change-tag-properties'),
    TestSuiteDict(name='blog-editor-tests/try-to-publish-a-duplicate-blog-post-and-get-blocked'),
    TestSuiteDict(name='curriculum-admin-tests/create-and-publish-topics-and-stories'),
    TestSuiteDict(name='exploration-editor-tests/load-complete-and-restart-exploration-preview'),
    TestSuiteDict(name='exploration-editor-tests/create-exploration-and-change-basic-settings'),
    TestSuiteDict(name='logged-in-user-tests/click-all-buttons-on-about-page'),
    TestSuiteDict(name='logged-in-user-tests/click-all-buttons-on-about-foundation-page'),
    TestSuiteDict(name='logged-in-user-tests/click-all-buttons-on-thanks-for-donating-page'),
    TestSuiteDict(name='logged-in-user-tests/click-all-buttons-on-navbar'),
    TestSuiteDict(name='logged-in-user-tests/click-all-links-in-about-oppia-footer'),
    TestSuiteDict(name='logged-in-user-tests/click-all-links-on-get-started-page'),
    TestSuiteDict(name='practice-question-admin-tests/add-and-remove-contribution-rights'),
    TestSuiteDict(name='translation-admin-tests/add-translation-rights'),
    TestSuiteDict(name='translation-admin-tests/remove-translation-rights'),
    TestSuiteDict(name='voiceover-admin-tests/add-voiceover-artist-to-an-exploration')
]

ALL_LIGHTHOUSE_TEST_SUITES = [
    TestSuiteDict(name='1'),
    TestSuiteDict(name='2'),
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
        if file_path.endswith(b'.py'):
            return True
    return False


def output_test_suites_to_run_to_github_workflow(
    output_variable: str,
    test_suites_to_run: List[TestSuiteDict]
) -> None:
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as o:
        print(f'{output_variable}={json.dumps(test_suites_to_run)}', file=o)
        

def output_test_suite_count_to_github_workflow(
    total_test_count: int
) -> None:
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as o:
        print(f'{ENVIRONMENT_TOTAL_TEST_SUITE_COUNT_OUTPUT}={total_test_count}', file=o)
        
        
def get_test_suites_to_modules_mapping(
    module_mapping_directory: str
) -> dict[str, List[str]]:
    test_suites_to_modules_mapping = {}
    for root, _, files in os.walk(module_mapping_directory):
        for file_path in files:
            with open(os.path.join(root, file_path), 'r', encoding='utf-8') as f:
                modules = f.read().splitlines()
                test_suites_to_modules_mapping[file_path] = modules
                
    return test_suites_to_modules_mapping


def get_test_suites_affected_by_module(
    module: str,
    test_suites_to_modules_mapping: dict[str, List[str]]
) -> List[str]:
    affected_tests = []
    for test_suite, modules in test_suites_to_modules_mapping.items():
        if module in modules:
            affected_tests.append(test_suite)
    return affected_tests
        
        
def collect_ci_test_suites_to_run(
    modified_files: List[str],
    dependency_graph: dict
) -> TestTypeSuiteMappingDict:
    modified_modules = []
    for file_path in modified_files:
        if file_path not in dependency_graph:
            return {
                'e2e': ALL_E2E_TEST_SUITES,
                'acceptance': ALL_ACCEPTANCE_TEST_SUITES,
                'lighthouse': ALL_LIGHTHOUSE_TEST_SUITES
            }
        file_modules = dependency_graph[file_path]
        for file_module in file_modules:
            if file_module not in modified_modules:
                modified_modules.append(file_module)
    
    # We are running all E2E tests regardless of the modified files. Remove this
    # after the E2E tests are removed. 
    e2e_test_suites = ALL_E2E_TEST_SUITES
    acceptance_test_suites: List[TestSuiteDict] = []
    lighthouse_test_suites: List[TestSuiteDict] = []

    acceptance_test_suites_to_modules_mapping = get_test_suites_to_modules_mapping(
        os.path.join(OPPIA_DIRECTORY, 'core/tests/acceptance-modules-mapping'))
    
    lighthouse_test_suites_to_modules_mapping = get_test_suites_to_modules_mapping(
        os.path.join(OPPIA_DIRECTORY, 'core/tests/lighthouse-modules-mapping'))
    
    for module in modified_modules:
        acceptance_test_suites.extend(
            get_test_suites_affected_by_module(module, acceptance_test_suites_to_modules_mapping))
        lighthouse_test_suites.extend(
            get_test_suites_affected_by_module(module, lighthouse_test_suites_to_modules_mapping))
    
    return {
        'e2e': e2e_test_suites,
        'acceptance': acceptance_test_suites,
        'lighthouse': lighthouse_test_suites
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
            ENVIRONMENT_LIGHTHOUSE_TEST_SUITES_OUTPUT, ALL_LIGHTHOUSE_TEST_SUITES)
        return
    
    generate_dependency_graph.main()
    with open(DEPEDENCY_GRAPH_PATH, 'r', encoding='utf-8') as f:
        dependency_graph = json.load(f)
        ci_test_suites_to_run = collect_ci_test_suites_to_run(modified_files, dependency_graph)
        total_suite_count = len(ci_test_suites_to_run['e2e']) + len(ci_test_suites_to_run['acceptance']) + len(ci_test_suites_to_run['lighthouse'])
        output_test_suite_count_to_github_workflow(total_suite_count)
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_E2E_TEST_SUITES_OUTPUT, ci_test_suites_to_run['e2e'])
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_ACCEPTANCE_TEST_SUITES_OUTPUT, ci_test_suites_to_run['acceptance'])
        output_test_suites_to_run_to_github_workflow(
            ENVIRONMENT_LIGHTHOUSE_TEST_SUITES_OUTPUT, ci_test_suites_to_run['lighthouse'])


# The 'no coverage' pragma is used as this line is un-testable. This is because
# it will only be called when check_e2e_tests_are_captured_in_ci.py
# is used as a script.
if __name__ == '__main__':  # pragma: no cover
    main()