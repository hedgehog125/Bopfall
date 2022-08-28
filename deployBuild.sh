#!/bin/bash

# TODO: Simplify by having a separate clone, so gitignored files are kept
exit


cd $(dirname $0)
if [ -n "$(git status --porcelain=v1 2>/dev/null)" ]
then
    echo "Please commit your changes before running"
    exit
fi

tmpDir=$(mktemp tmp.XXXXXXXXXX -td)
cp -r static/build/* ${tmpDir}
git checkout gh-pages

rm -r *
mv ${tmpDir}/* .

rm -r ${tmpDir}

echo "
Now make a commit for this new build and change back to the main branch.
"
exit
