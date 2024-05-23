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

"""A script to generate a dependency graph of the Oppia codebase."""

from __future__ import annotations

import subprocess
import os

from scripts import common


def main() -> None:
    common.compile_typescript_test_dependencies()
    print('Generating dependency graph...')
    dependency_graph_generator_path = os.path.join(
        'core', 'tests', 'test-dependencies', 'dependency-graph-generator.js') 
    cmd = [common.NODE_BIN_PATH, dependency_graph_generator_path]
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    encoded_stdout, encoded_sterr = proc.communicate()
    stderr = encoded_sterr.decode('utf-8')
    
    if stderr:
        raise Exception(stderr)
    
    print(encoded_stdout.decode('utf-8'))
    print('Dependency graph generated successfully!')


# The 'no coverage' pragma is used as this line is un-testable. This is because
# it will only be called when build.py is used as a script.
if __name__ == '__main__':  # pragma: no cover
    main()
