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

"""Unit tests for scripts/github_api.py."""

from __future__ import annotations

import contextlib
import json
import subprocess
import textwrap
from unittest import mock
import urllib.request as urlrequest

from core.tests import test_utils

from typing import Any, Dict, Iterator, List

from . import github_api


class MockProcessOutput:
    returncode = 0
    stdout = ''


class MockUrlOpenResponse:
    class MockBody:
        def __init__(self, body: str) -> None:
            self.body = body

        def decode(self, _: str) -> str:
            """Mock decode method for the body."""
            return self.body

    def __init__(self, status_code: int, body: str) -> None:
        self.status_code = status_code
        self.body = self.MockBody(body)

    def __enter__(self) -> MockUrlOpenResponse:
        return self

    def __exit__(self, *_: int) -> None:
        pass

    def getcode(self) -> int:
        """Mock getcode method for the response."""
        return self.status_code

    def read(self) -> MockBody:
        """Mock read method for the response."""
        return self.body


class GithubApiTests(test_utils.GenericTestBase):
    """Unit tests for testing the github_api script."""

    def setUp(self) -> None:
        super().setUp()
        self.gh_help_cmd = ['gh', 'help']
        self.gh_auth_cmd = ['gh', 'auth', 'token']

    def test_deep_get(self) -> None:
        self.assertEqual(
            github_api.deep_get(
                {'a': {'b': {'c': 1}}}, ['a', 'b', 'c']
            ), 1)
        self.assertEqual(
            github_api.deep_get(
                {'a': {'b': {'c': 'string'}}}, ['a', 'b', 'c']
            ), 'string')
        self.assertEqual(
            github_api.deep_get(
                {'a': {'b': {'c': 1}}}, ['a', 'b']
            ), {'c': 1})
        self.assertEqual(
            github_api.deep_get(
                {'a': {'b': {'c': 1}}}, ['a', 'd']
            ), None)

    @contextlib.contextmanager
    def swap_to_successful_gh_subprocess_run(
        self
    ) -> Iterator[None]:
        """Swaps a subprocess.run call for a working Github CLI."""
        def mock_subprocess_run(cmd: List[str], **_: str) -> MockProcessOutput:
            if cmd == self.gh_help_cmd:
                return MockProcessOutput()
            elif cmd == self.gh_auth_cmd:
                gh_auth_process_output = MockProcessOutput()
                gh_auth_process_output.stdout = 'github_pat_11A'
                return gh_auth_process_output
            else:
                raise Exception(
                    'Invalid command passed to subprocess.run method')
        with self.swap(subprocess, 'run', mock_subprocess_run):
            yield

    @contextlib.contextmanager
    def swap_to_graphql_urlopen(
        # Here we use type Any because the body is a dictionary where the keys
        # are strings and the values can be of any type.
        self, body: Dict[str, Any], status_code: int, query: str
    ) -> Iterator[None]:
        """Swaps the urlopen method for a Github API GraphQL query."""
        def mock_urlopen(
            request: urlrequest.Request
        ) -> MockUrlOpenResponse:
            self.assertEqual(
                request.headers['Authorization'], 'Bearer github_pat_11A')
            self.assertEqual(
                request.full_url, f'{github_api.GITHUB_API_URL}/graphql')
            expected_constructed_query = textwrap.dedent(
                """
                query {
                    repository(owner: "%s", name: "%s") {
                        %s
                    }
                }
                """
            ) % (
                github_api.REPOSITORY_OWNER,
                github_api.REPOSITORY_NAME,
                query)
            self.assertEqual(
                request.data,
                json.dumps(
                    {'query': expected_constructed_query}).encode('utf-8'))
            constructed_body = json.dumps({'data': {'repository': body}})
            return MockUrlOpenResponse(status_code, constructed_body)
        with self.swap(urlrequest, 'urlopen', mock_urlopen):
            yield

    def test_no_github_cli_throws_error(self) -> None:
        failed_process_output = MockProcessOutput()
        failed_process_output.returncode = 1

        def mock_subprocess_run(cmd: List[str], **_: str) -> MockProcessOutput:
            if cmd == self.gh_help_cmd:
                return failed_process_output
            elif cmd == self.gh_auth_cmd:
                return MockProcessOutput()
            else:
                raise Exception(
                    'Invalid command passed to subprocess.run method')
        swap_subprocess_run = self.swap(subprocess, 'run', mock_subprocess_run)
        error_message = (
            'Github CLI is not installed. Please install the Github CLI ' +
            'before running Github API functions.')
        with swap_subprocess_run, self.assertRaisesRegex(
            RuntimeError, error_message):
            github_api.get_github_auth_token()

    def test_bad_github_auth_token_throws_error(self) -> None:
        failed_process_output = MockProcessOutput()
        failed_process_output.returncode = 1

        def mock_subprocess_run(cmd: List[str], **_: str) -> MockProcessOutput:
            if cmd == self.gh_help_cmd:
                return MockProcessOutput()
            elif cmd == self.gh_auth_cmd:
                return failed_process_output
            else:
                raise Exception(
                    'Invalid command passed to subprocess.run method')
        swap_subprocess_run = self.swap(subprocess, 'run', mock_subprocess_run)
        error_message = (
            'Failed to get Github Auth Token from the Github CLI.')
        with swap_subprocess_run, self.assertRaisesRegex(
            RuntimeError, error_message):
            github_api.get_github_auth_token()

    def test_get_authorization_bearer(self) -> None:
        with self.swap_to_successful_gh_subprocess_run():
            self.assertEqual(
                github_api.get_authorization_bearer(),
                'Bearer github_pat_11A')

    def test_run_graphql_query_unauthorized_throws_error(self) -> None:
        def mock_urlopen(_: urlrequest.Request) -> MockUrlOpenResponse:
            return MockUrlOpenResponse(401, 'Unauthorized')
        swap_urlopen = self.swap(
            urlrequest, 'urlopen', mock_urlopen)
        error_message = (
            'Failed to run the GraphQL query due to an API error: Unauthorized')
        with self.swap_to_successful_gh_subprocess_run(), swap_urlopen:
            with self.assertRaisesRegex(RuntimeError, error_message):
                github_api.run_graphql_query('query')

    def test_run_graphql_query_request_error_throws_error(self) -> None:
        mock_urlopen = mock.Mock(side_effect=Exception('Timeout'))
        swap_urlopen = self.swap(
            urlrequest, 'urlopen', mock_urlopen)
        error_message = (
            'Failed to run the GraphQL query due to a request error: Timeout')
        with self.swap_to_successful_gh_subprocess_run(), swap_urlopen:
            with self.assertRaisesRegex(RuntimeError, error_message):
                github_api.run_graphql_query('query')

    def test_run_graphql_query_success(self) -> None:
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen({}, 200, 'query'):
                self.assertEqual(
                    github_api.run_graphql_query('query'), {'repository': {}})

    def test_fetch_linked_issues_for_pull_request_success(self) -> None:
        query = textwrap.dedent(
            """
            pullRequest(number: 12345) {
                closingIssuesReferences(first: 50) {
                    nodes {
                        body
                        number
                        title
                    }
                }
            }
            """)
        body = {
            'pullRequest': {
                'closingIssuesReferences': {
                    'nodes': [
                        {
                            'body': 'Body Number 1',
                            'number': 1,
                            'title': 'Issue Title Number 1'
                        },
                        {
                            'body': 'Body Number 4252',
                            'number': 4252,
                            'title': 'Issue Title Number 4252'
                        }
                    ]
                }
            }
        }
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen(body, 200, query):
                self.assertEqual(
                    github_api.fetch_linked_issues_for_pull_request(12345), [
                        {
                            'body': 'Body Number 1',
                            'number': 1,
                            'title': 'Issue Title Number 1'
                        },
                        {
                            'body': 'Body Number 4252',
                            'number': 4252,
                            'title': 'Issue Title Number 4252'
                        }
                    ])

    def test_fetch_linked_issues_for_pull_request_nonexistent_throws_error(
        self
    ) -> None:
        query = textwrap.dedent(
            """
            pullRequest(number: 12345) {
                closingIssuesReferences(first: 50) {
                    nodes {
                        body
                        number
                        title
                    }
                }
            }
            """)
        body = {
            'pullRequest': None
        }
        error_message = r'The pull request \(#12345\) does not exist.'
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen(body, 200, query):
                with self.assertRaisesRegex(Exception, error_message):
                    github_api.fetch_linked_issues_for_pull_request(12345)

    def test_fetch_latest_comment_from_issue_nonexistent_throws_error(
        self
    ) -> None:
        query = textwrap.dedent(
            """
            issue(number: 12343) {
                comments(last: 1) {
                    nodes {
                        body
                    }
                }
            }
            """)
        body = {
            'issue': None
        }
        error_message = r'The issue \(#12343\) does not exist.'
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen(body, 200, query):
                with self.assertRaisesRegex(Exception, error_message):
                    github_api.fetch_latest_comment_from_issue(12343)

    def test_fetch_latest_comment_from_issue_success(self) -> None:
        query = textwrap.dedent(
            """
            issue(number: 12345) {
                comments(last: 1) {
                    nodes {
                        body
                    }
                }
            }
            """)
        body = {
            'issue': {
                'comments': {
                    'nodes': [
                        {
                            'body': 'Comment Body Number 1'
                        }
                    ]
                }
            }
        }
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen(body, 200, query):
                self.assertEqual(
                    github_api.fetch_latest_comment_from_issue(12345), {
                        'body': 'Comment Body Number 1'
                    })

    def test_fetch_latest_comment_from_pull_request_nonexistent_throws_error(
        self
    ) -> None:
        query = textwrap.dedent(
            """
            pullRequest(number: 12345) {
                comments(last: 1) {
                    nodes {
                        body
                    }
                }
            }
            """)
        body = {
            'pullRequest': None
        }
        error_message = r'The pull request \(#12345\) does not exist.'
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen(body, 200, query):
                with self.assertRaisesRegex(Exception, error_message):
                    github_api.fetch_latest_comment_from_pull_request(12345)

    def test_fetch_latest_comment_from_pull_request_success(self) -> None:
        query = textwrap.dedent(
            """
            pullRequest(number: 12345) {
                comments(last: 1) {
                    nodes {
                        body
                    }
                }
            }
            """)
        body = {
            'pullRequest': {
                'comments': {
                    'nodes': [
                        {
                            'body': 'Comment Body Number 1'
                        }
                    ]
                }
            }
        }
        with self.swap_to_successful_gh_subprocess_run():
            with self.swap_to_graphql_urlopen(body, 200, query):
                self.assertEqual(
                    github_api.fetch_latest_comment_from_pull_request(12345), {
                        'body': 'Comment Body Number 1'
                    })