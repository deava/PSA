from invoke import task

@task
def start(ctx):
    ctx.run("py3 src/app.py")
@task
def test(ctx):
    ctx.run("pytest src")
@task
def coverage(ctx):
    ctx.run("coverage run --branch -m pytest")

@task(coverage)
def coverage_report(ctx):
    ctx.run("coverage html")

