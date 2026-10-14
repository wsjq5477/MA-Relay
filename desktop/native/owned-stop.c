#define _GNU_SOURCE
#include <sys/syscall.h>
#include <sys/stat.h>
#include <unistd.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
// Hold a kernel reference before checking /proc: PID reuse cannot redirect a signal.
int main(int argc,char **argv){
 if(argc!=4){return 2;}
 char *end;long pid=strtol(argv[1],&end,10);if(*end||pid<2)return 2;
 long uid=strtol(argv[3],&end,10);if(*end||uid!=(long)getuid())return 2;
 int fd=syscall(SYS_pidfd_open,(pid_t)pid,0);if(fd<0)return errno==ESRCH?0:3;
 char file[80],buffer[8192];snprintf(file,sizeof file,"/proc/%ld/stat",pid);struct stat st;if(stat(file,&st)||st.st_uid!=(uid_t)uid){close(fd);return 4;}
 FILE *f=fopen(file,"r");if(!f){close(fd);return 4;}if(!fgets(buffer,sizeof buffer,f)){fclose(f);close(fd);return 4;}fclose(f);
 char *tail=strrchr(buffer,')');if(!tail){close(fd);return 4;}tail+=2;char *save,*word=strtok_r(tail," ",&save);int index=0;while(word&&index<19){word=strtok_r(NULL," ",&save);index++;}
 if(!word||strcmp(word,argv[2])){close(fd);return 5;}
 int result=syscall(SYS_pidfd_send_signal,fd,SIGTERM,NULL,0);int error=errno;close(fd);return result==0||error==ESRCH?0:6;
}
