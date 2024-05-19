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


def main() -> None:
    cmd = (
        './node_modules/typescript/bin/tsc --esModuleInterop %s' %
        './core/tests/dependency-graph-generator.ts && %s' %
        'node core/tests/dependency-graph-generator.js')
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    
    encoded_stdout, encoded_sterr = proc.communicate()
    stderr = encoded_sterr.decode('utf-8')
    
    if stderr:
        raise Exception(stderr)
    
    print(encoded_stdout.decode('utf-8'))


# The 'no coverage' pragma is used as this line is un-testable. This is because
# it will only be called when build.py is used as a script.
if __name__ == '__main__':  # pragma: no cover
    main()
