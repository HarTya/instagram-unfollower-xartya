const { IgApiClient } = require('instagram-private-api')

const ig = new IgApiClient()

const readline = require('readline')

console.log('\nInstagram Unfollower by XarTya.\n')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

rl.question('Ник: ', username => {
	rl.question('Пароль: ', password => {
		unfollower(username, password)
	})
})

function twoFactorAccess(username, authError) {
	rl.question('Код подтверждения: ', code => {
		const { two_factor_identifier } = authError.response.body.two_factor_info

		ig.account
			.twoFactorLogin({
				username,
				verificationCode: code,
				twoFactorIdentifier: two_factor_identifier,
				trustThisDevice: '1',
				verificationMethod: '1',
			})
			.catch(err => {
				console.log(
					'Ошибка двухфакторной аутентификации: ' + err.message.split('; ')[1]
				)
			})
	})
}

async function unfollower(username, password) {
	let error = false
	ig.state.generateDevice(username)

	try {
		await ig.simulate.preLoginFlow()
	} catch (error) {
		console.log(
			'\nНе удалось выполнить предварительный вход в Instagram: ' +
				error.message.split('; ')[1]
		)
		console.log('Повторная попытка входа в систему...\n')
	}

	instagram()

	async function instagram() {
		const auth = await ig.account.login(username, password).catch(authError => {
			const errorArray = authError.message.split('; ')

			if (!errorArray[errorArray.length - 1]) {
				errorArray.length = 1
			}

			console.log(
				'Ошибка входа в аккаунт: ' +
					authError.message.split('; ')[errorArray.length - 1]
			)

			if (!authError.response.body.two_factor_info) {
				return
			}

			twoFactorAccess(username, authError)
		})

		if (auth) {
			console.log(`Успешный вход в аккаунт: ${auth.username}!`)
			const followersFeed = ig.feed.accountFollowers(auth.pk)
			const followingFeed = ig.feed.accountFollowing(auth.pk)
			const followers = [...(await followersFeed.items())]
			const following = [...(await followingFeed.items())]
			if (!following.length) {
				error = true
				console.log('Извините. Вы не на кого не подписаны.')
			}
			if (!error) {
				const users = new Set(followers.map(({ username }) => username))
				const notFollowingYou = following.filter(
					({ username }) => !users.has(username)
				)
				if (!notFollowingYou.length) {
					error = true
					console.log('Все на кого вы подписаны, подписались на вас в ответ.')
				}
				if (!error) {
					console.log(
						'\nПо завершении всех необходимых процедур программа выйдет из вашей учетной записи.\n'
					)
					let failedUnfollow = ''
					for (const user of notFollowingYou) {
						try {
							await ig.friendship.destroy(user.pk)
							console.log(`Удалось отписаться от: ${user.username}`)
						} catch {
							failedUnfollow += `${user.username}\n`
							console.log(`Ошибка! Не удалось отписаться от: ${user.username}`)
						}
					}
					if (failedUnfollow) {
						console.log(
							`\nВыполнено с некоторыми проблемами...\n\nПользователи от которых не удалось отписаться:\n${failedUnfollow}`
						)
					} else {
						console.log(`\nВыполнено успешно!`)
					}
				}
			}
			await ig.account.logout()
		}
	}
}
