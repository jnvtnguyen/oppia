# Copyright 2024 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS-IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Unit tests for scripts/check_ci_test_suites_to_run.py."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile

from core.tests import test_utils
from scripts import check_ci_test_suites_to_run


class CheckCITestSuitesToRunTests(test_utils.GenericTestBase):
    def setUp(self) -> None:
        super().setUp()

        self.tempdir = tempfile.TemporaryDirectory()
        root_files_mapping_file = os.path.join(
            self.tempdir.name, 'root-files-mapping.json')
        with open(root_files_mapping_file, 'w', encoding='utf-8') as f:
            f.write(json.dumps({
                'README.md': ['README.md'],
                'assets/README.md': ['assets/README.md'],
                'CODEOWNERS': ['CODEOWNERS'],
                'src/main.ts': ['src/main.ts'],
                'splash-banner.component.html': ['splash-page.module.ts'],
                'about-component.ts': ['about-page.module.ts'],
                'terms.component.html': ['terms-page.module.ts'],
                'privacy-policy.component.ts': ['privacy-page.module.ts'],
                'exploration-player.component.html': [
                    'exploration-player-page.module.ts'
                ],
                'exploration-player-banners.component.html': [
                    'exploration-player-page.module.ts'
                ],
                'exploration-player/view-exploration.spec.ts': [
                    'exploration-player/view-exploration.spec.ts'
                ],
            }))
        root_files_config_file = os.path.join(
            self.tempdir.name, 'root-files-config.json')
        with open(root_files_config_file, 'w', encoding='utf-8') as f:
            f.write(json.dumps({
                'VALID_ROOT_FILES': [
                    'README.md',
                    'assets/README.md',
                    'CODEOWNERS'
                ],
                'RUN_ALL_TESTS_ROOT_FILES': [
                    'src/main.ts' 
                ]
            }))
        lighthouse_pages_config_file = os.path.join(
            self.tempdir.name, 'lighthouse-pages.json')
        with open(lighthouse_pages_config_file, 'w', encoding='utf-8') as f:
            f.write(json.dumps({
                'shards': {
                    '1': {
                        'splash': {
                            'url': 'http://localhost:8181/',
                            'page_module': 'splash-page.module.ts'
                        },
                        'about': {
                            'url': 'http://localhost:8181/about',
                            'page_module': 'about-page.module.ts'
                        },
                    },
                    '2': {
                        'terms': {
                            'url': 'http://localhost:8181/terms',
                            'page_module': 'terms-page.module.ts'
                        },
                        'privacy-policy': {
                            'url': 'http://localhost:8181/privacy-policy',
                            'page_module': 'privacy-page.module.ts'
                        },
                        'exploration-player': {
                            'url': 'http://localhost:8181/explore/{{topic_id}}',
                            'page_module': 'exploration-player-page.module.ts'
                        }
                    }
                }
            }))
        ci_test_suite_configs_directory = os.path.join(
            self.tempdir.name, 'ci-test-suite-configs')
        os.mkdir(ci_test_suite_configs_directory)
        with open(
            os.path.join(ci_test_suite_configs_directory, 'acceptance.json'),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(json.dumps({
                'suites': [
                    {
                        'name': 'blog-admin/assign-roles',
                        'module': 'blog-admin/assign-roles.spec.ts'
                    },
                    {
                        'name': 'blog-editor/publish',
                        'module': 'blog-editor/publish.spec.ts'
                    },
                    {
                        'name': 'exploration-player/view-exploration',
                        'module': 'exploration-player/view-exploration.spec.ts'
                    }
                ]
            }))
        with open(
            os.path.join(ci_test_suite_configs_directory, 'e2e.json'),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(json.dumps({
                'suites': [
                    {
                        'name': 'accessibility',
                        'module': 'accessibility.js'
                    },
                    {
                        'name': 'additionalEditorFeatures',
                        'module': 'additionalEditorFeatures.js'
                    },
                    {
                        'name': 'additionalEditorFeaturesModals',
                        'module': 'additionalEditorFeaturesModals.js'
                    }
                ]
            }))
        with open(
            os.path.join(
                ci_test_suite_configs_directory,
                'lighthouse-accessibility.json'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(json.dumps({
                'suites': [
                    {
                        'name': '1',
                        'module': '.lighthouserc-accessibility-1.js'
                    },
                    {
                        'name': '2',
                        'module': '.lighthouserc-accessibility-2.js'
                    }
                ]
            }))
        with open(
            os.path.join(
                ci_test_suite_configs_directory,
                'lighthouse-performance.json'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(json.dumps({
                'suites': [
                    {
                        'name': '1',
                        'module': '.lighthouserc-performance-1.js'
                    },
                    {
                        'name': '2',
                        'module': '.lighthouserc-performance-2.js'
                    }
                ]
            }))
        test_modules_mapping_directory = os.path.join(
            self.tempdir.name, 'test-modules-mapping')
        os.mkdir(test_modules_mapping_directory)
        acceptance_test_modules_mapping_directory = os.path.join(
            test_modules_mapping_directory, 'acceptance')
        os.mkdir(acceptance_test_modules_mapping_directory)
        os.mkdir(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'blog-admin'
            )
        )
        with open(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'blog-admin/assign-roles.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write('blog-admin-page.module.ts')
        with open(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'blog-admin/delete-blog-post.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write('blog-admin-page.module.ts')
        os.mkdir(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'blog-editor'
            )
        )
        with open(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'blog-editor/publish.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(
                'blog-admin-page.module.ts\n'
                'blog-dashboard-page.module.ts'
            )
        os.mkdir(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'exploration-player'
            )
        )
        with open(
            os.path.join(
                acceptance_test_modules_mapping_directory,
                'exploration-player/view-exploration.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write('exploration-player-page.module.ts')
        lighthouse_accessibility_test_modules_mapping_directory = os.path.join(
            test_modules_mapping_directory, 'lighthouse-accessibility')
        os.mkdir(lighthouse_accessibility_test_modules_mapping_directory)
        with open(
            os.path.join(
                lighthouse_accessibility_test_modules_mapping_directory,
                '1.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(
                'splash-page.module.ts\n'
                'about-page.module.ts'
            )
        with open(
            os.path.join(
                lighthouse_accessibility_test_modules_mapping_directory,
                '2.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(
                'terms-page.module.ts\n'
                'privacy-page.module.ts\n'
                'exploration-player-page.module.ts'
            )
        lighthouse_performance_test_modules_mapping_directory = os.path.join(
            test_modules_mapping_directory, 'lighthouse-performance')
        os.mkdir(lighthouse_performance_test_modules_mapping_directory)
        with open(
            os.path.join(
                lighthouse_performance_test_modules_mapping_directory,
                '1.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(
                'splash-page.module.ts\n'
                'about-page.module.ts'
            )
        with open(
            os.path.join(
                lighthouse_performance_test_modules_mapping_directory,
                '2.txt'
            ),
            'w',
            encoding='utf-8'
        ) as f:
            f.write(
                'terms-page.module.ts\n'
                'privacy-page.module.ts\n'
                'exploration-player-page.module.ts'
            )

        self.root_files_mapping_file_path_swap = self.swap(
            check_ci_test_suites_to_run, 'ROOT_FILES_MAPPING_FILE_PATH',
            root_files_mapping_file)
        self.root_files_config_file_path_swap = self.swap(
            check_ci_test_suites_to_run, 'ROOT_FILES_CONFIG_FILE_PATH',
            root_files_config_file)
        self.lighthouse_pages_config_file_path_swap = self.swap(
            check_ci_test_suites_to_run, 'LIGHTHOUSE_PAGES_CONFIG_FILE_PATH',
            lighthouse_pages_config_file)
        self.ci_test_suite_configs_directory_swap = self.swap(
            check_ci_test_suites_to_run, 'CI_TEST_SUITE_CONFIGS_DIRECTORY',
            ci_test_suite_configs_directory)
        self.test_modules_mapping_directory_swap = self.swap(
            check_ci_test_suites_to_run, 'TEST_MODULES_MAPPING_DIRECTORY',
            test_modules_mapping_directory)
        self.github_output_file_path = os.path.join(
            self.tempdir.name, 'github-output.json')
        os.environ['GITHUB_OUTPUT'] = self.github_output_file_path

        self.all_test_suites = {
            'acceptance': {
                'suites': [
                    {'name': 'blog-admin/assign-roles'},
                    {'name': 'blog-editor/publish'},
                    {'name': 'exploration-player/view-exploration'}
                ],
                'count': 3
            },
            'e2e': {
                'suites': [
                    {'name': 'accessibility'},
                    {'name': 'additionalEditorFeatures'},
                    {'name': 'additionalEditorFeaturesModals'}
                ],
                'count': 3
            },
            'lighthouse_accessibility': {
                'suites': [
                    {
                        'name': '1',
                        'pages_to_run': ['splash', 'about']
                    },
                    {
                        'name': '2',
                        'pages_to_run': [
                            'terms',
                            'privacy-policy',
                            'exploration-player'
                        ]
                    }
                ],
                'count': 2
            },
            'lighthouse_performance': {
                'suites': [
                    {
                        'name': '1',
                        'pages_to_run': ['splash', 'about']
                    },
                    {
                        'name': '2', 
                        'pages_to_run': [
                            'terms',
                            'privacy-policy',
                            'exploration-player'
                        ]
                    }
                ],
                'count': 2
            }
        }

    def tearDown(self) -> None:
        super().tearDown()
        self.tempdir.cleanup()

    def get_test_suites_to_run_from_github_output(self) -> dict:
        """Get the test suites to run from the GitHub output file."""
        with open(self.github_output_file_path, 'r', encoding='utf-8') as f:
            return json.loads(f.read().split('=')[1])

    def test_get_git_diff_name_status_files_without_error(self) -> None:
        class MockSubprocessPopen:
            """Mocks the subprocess.Popen class."""

            returncode = 0
            def communicate(self) -> tuple[bytes, bytes]:
                """Mocks the communicate method of subprocess.Popen class."""
                return (
                    b'M core/components/oppia-angular-root.component.html\n'
                    b'M core/constants.py\n'
                    b'A core/utils.py\n'
                    b'R core/templates/pages/Base.ts\n',
                    b''
                )

        def mock_popen(*args, **kwargs) -> MockSubprocessPopen: # pylint: disable=unused-argument
            return MockSubprocessPopen()

        swap_popen = self.swap(
            subprocess, 'Popen', mock_popen)

        with swap_popen:
            git_diff_name_status_files = (
                check_ci_test_suites_to_run.get_git_diff_name_status_files(
                    'left', 'right')
            )
            self.assertEqual(
                git_diff_name_status_files,
                [
                    'core/components/oppia-angular-root.component.html',
                    'core/constants.py',
                    'core/utils.py',
                    'core/templates/pages/Base.ts'
                ]
            )

    def test_get_git_diff_name_status_files_with_error(self) -> None:
        class MockSubprocessPopen:
            """Mocks an error in the subprocess.Popen class."""

            returncode = 1
            def communicate(self) -> tuple[bytes, bytes]:
                """Mocks the communicate method of subprocess.Popen class."""
                return (
                    b'',
                    b'fatal: not a valid git branch\n'
                )

        def mock_popen(*args, **kwargs) -> MockSubprocessPopen: # pylint: disable=unused-argument
            return MockSubprocessPopen()

        swap_popen = self.swap(
            subprocess, 'Popen', mock_popen)

        with swap_popen:
            with self.assertRaisesRegex(
                ValueError, 'fatal: not a valid git branch'
            ):
                check_ci_test_suites_to_run.get_git_diff_name_status_files(
                    'left', 'right')

    def test_does_files_include_python(self) -> None:
        self.assertTrue(
            check_ci_test_suites_to_run.does_files_include_python(
                ['core/components/oppia-angular-root.component.html',
                 'core/constants.py',
                 'core/utils.py',
                 'core/templates/pages/Base.ts']
            )
        )
        self.assertFalse(
            check_ci_test_suites_to_run.does_files_include_python(
                ['core/components/oppia-angular-root.component.html',
                 'core/templates/pages/Base.ts']
            )
        )

    def test_check_ci_test_suites_to_run_with_output_all_suites(self) -> None:
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    check_ci_test_suites_to_run.main(
                        [
                            '--github_base_ref', 'base',
                            '--github_head_ref', 'head',
                            '--output_all_test_suites'
                        ]
                    )
                    self.assertEqual(
                        self.get_test_suites_to_run_from_github_output(),
                        self.all_test_suites
                    )

    def test_check_ci_test_suites_to_run_with_python_file(self) -> None:
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: ['core/constants.py', 'core/utils.py']
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(), # pylint: disable=line-too-long
                            self.all_test_suites
                        )

    def test_check_ci_test_suites_to_run_with_file_not_in_root_file_mapping(self) -> None: # pylint: disable=line-too-long
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: ['package.json']
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(), # pylint: disable=line-too-long
                            self.all_test_suites
                        )

    def test_check_ci_test_suites_to_run_with_no_tests_corresponding_to_changed_files(self) -> None: # pylint: disable=line-too-long
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: [
                            'README.md',
                            'assets/README.md',
                            'CODEOWNERS'
                        ]
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(), # pylint: disable=line-too-long
                            {
                                'e2e': self.all_test_suites['e2e'],
                                'acceptance': {
                                    'suites': [],
                                    'count': 0
                                },
                                'lighthouse_accessibility': {
                                    'suites': [],
                                    'count': 0
                                },
                                'lighthouse_performance': {
                                    'suites': [],
                                    'count': 0
                                }
                            }
                        )

    def test_check_ci_test_suites_to_run_with_run_all_tests_root_file(self) -> None: # pylint: disable=line-too-long
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: ['src/main.ts']
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(),
                            self.all_test_suites
                        )

    def test_check_ci_test_suites_to_run_with_partial_root_file_changes(self) -> None: # pylint: disable=line-too-long
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: [
                            'splash-banner.component.html',
                            'about-component.ts',
                            'terms.component.html',
                            'exploration-player.component.html',
                            'exploration-player-banners.component.html'
                        ]
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(),
                            {
                                'e2e': self.all_test_suites['e2e'],
                                'acceptance': {
                                    'suites': [
                                        {'name': 'exploration-player/view-exploration'} # pylint: disable=line-too-long
                                    ],
                                    'count': 1
                                },
                                'lighthouse_accessibility': {
                                    'suites': [
                                        {
                                            'name': '1',
                                            'pages_to_run': [
                                                'splash',
                                                'about'
                                            ]
                                        },
                                        {
                                            'name': '2',
                                            'pages_to_run': [
                                                'terms',
                                                'exploration-player'
                                            ]
                                        }
                                    ],
                                    'count': 2
                                },
                                'lighthouse_performance': {
                                    'suites': [
                                        {
                                            'name': '1',
                                            'pages_to_run': [
                                                'splash',
                                                'about'
                                            ]
                                        },
                                        {
                                            'name': '2',
                                            'pages_to_run': [
                                                'terms',
                                                'exploration-player'
                                            ]
                                        }
                                    ],
                                    'count': 2
                                }
                            }
                        )

    def test_check_ci_test_suites_to_run_with_changed_test_module(self) -> None: # pylint: disable=line-too-long
        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: [
                            'exploration-player/view-exploration.spec.ts'
                        ]
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(),
                            {
                                'e2e': self.all_test_suites['e2e'],
                                'acceptance': {
                                    'suites': [
                                        {'name': 'exploration-player/view-exploration'} # pylint: disable=line-too-long
                                    ],
                                    'count': 1
                                },
                                'lighthouse_accessibility': {
                                    'suites': [],
                                    'count': 0
                                },
                                'lighthouse_performance': {
                                    'suites': [],
                                    'count': 0
                                }
                            }
                        )

    def test_check_ci_test_suites_to_run_with_missing_test_suite_to_module_mapping(self) -> None: # pylint: disable=line-too-long
        acceptance_config_file_path = os.path.join(
            self.tempdir.name,
            'ci-test-suite-configs',
            'acceptance.json'
        )
        with open(
            acceptance_config_file_path,
            'r',
            encoding='utf-8'
        ) as f:
            acceptance_config = json.load(f)
            acceptance_config['suites'].append({
                'name': 'blog-admin/create-blog-post',
                'module': 'blog-admin/create-blog-post.spec.ts'
            })

        with open(
            acceptance_config_file_path,
            'w+',
             encoding='utf-8'
        ) as f:
            f.write(json.dumps(acceptance_config))

        with self.root_files_mapping_file_path_swap, self.lighthouse_pages_config_file_path_swap: # pylint: disable=line-too-long
            with self.ci_test_suite_configs_directory_swap, self.test_modules_mapping_directory_swap: # pylint: disable=line-too-long
                with self.root_files_config_file_path_swap:
                    with self.swap(
                        check_ci_test_suites_to_run,
                        'get_git_diff_name_status_files',
                        lambda *args: [
                            'README.md'
                        ]
                    ):
                        check_ci_test_suites_to_run.main(
                            [
                                '--github_base_ref', 'base',
                                '--github_head_ref', 'head'
                            ]
                        )
                        self.assertEqual(
                            self.get_test_suites_to_run_from_github_output(),
                            {
                                'e2e': self.all_test_suites['e2e'],
                                'acceptance': {
                                    'suites': [
                                        {'name': 'blog-admin/create-blog-post'}
                                    ],
                                    'count': 1
                                },
                                'lighthouse_accessibility': {
                                    'suites': [],
                                    'count': 0
                                },
                                'lighthouse_performance': {
                                    'suites': [],
                                    'count': 0
                                }
                            }
                        )
