from invoke import task

@task
def build(ctx):
    ctx.run("py src/initialize_database.py")

@task
def start(ctx):
    ctx.run("py src/app.py")
@task
def test(ctx):
    ctx.run("pytest src")
@task
def coverage(ctx):
    ctx.run("coverage run --branch -m pytest src")

@task(coverage)
def coverage_report(ctx):
    ctx.run("coverage html")

@task
def pylint(ctx):
    ctx.run("pylint src")

@task
def format(ctx):
    ctx.run("autopep8 --in-place --recursive src")