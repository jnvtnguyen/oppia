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

"""A script to check which e2e test suites to run in the CI."""

from __future__ import annotations

import json
import os

# These are just test constants to check if we can output partial tests to the
# github workflow.
E2E_TESTS_TO_RUN = [
    'accessibility',
    'additionalEditorFeatures',
    'embedding',
    'fileUploadFeatures',
    'navigation',
    'preferences'
]

LIGHTHOUSE_TESTS_TO_RUN = [
    1
]

ACCEPTANCE_TESTS_TO_RUN = [
    'blog-admin-tests/assign-roles-to-users-and-change-tab-properties',
    'logged-in-user-tests/click-all-buttons-on-navbar',
    'practice-question-admin-tests/add-and-remove-contribution-rights',
    'translation-admin-tests/remove-translation-rights'
]


def main() -> None:
    """Outputs the e2e test suites to run in the CI."""
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as f:
        print(f'E2E_TESTS_TO_RUN={json.dumps(E2E_TESTS_TO_RUN)}', file=f)
        print(
            f'LIGHTHOUSE_TESTS_TO_RUN={json.dumps(LIGHTHOUSE_TESTS_TO_RUN)}',
            file=f
        )
        print(
            f'ACCEPTANCE_TESTS_TO_RUN={json.dumps(ACCEPTANCE_TESTS_TO_RUN)}',
            file=f
        )


# The 'no coverage' pragma is used as this line is un-testable. This is because
# it will only be called when check_e2e_tests_are_captured_in_ci.py
# is used as a script.
if __name__ == '__main__':  # pragma: no cover
    main()
