@ECHO OFF
SETLOCAL

SET JAVA_EXE=java.exe
IF DEFINED JAVA_HOME (
  SET JAVA_EXE=%JAVA_HOME%\bin\java.exe
)

"%JAVA_EXE%" -Xmx64m -Xms64m -classpath "%~dp0\gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
