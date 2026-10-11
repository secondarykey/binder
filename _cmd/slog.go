package main

import (
	"fmt"

	"github.com/wenteasy/log"
)

func main() {
	run()
}

func run() error {

	defer log.NoneStop()
	defer log.PrintTrace(log.Func("run()"))

	err := fmt.Errorf("run() error")
	log.PrintStackTrace(err)

	panic(err)

	return err
}
