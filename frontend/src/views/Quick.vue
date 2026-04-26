<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
    RefreshFilled,
    ContentCopyFilled,
    ArrowBackIosNewFilled,
    ArrowForwardIosFilled,
} from '@vicons/material'
import axios from 'axios'

import { processItem } from '../utils/email-parser'
import MailContentRenderer from '../components/MailContentRenderer.vue'
import { useGlobalState } from '../store'

const API_BASE = import.meta.env.VITE_API_BASE || "";
const route = useRoute()
const router = useRouter()
const message = useMessage()
const { isDark } = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            title: 'Quick Mail',
            placeholder: 'Enter email address, e.g. test@example.com',
            query: 'Query',
            refreshMails: 'Refresh',
            copyAddress: 'Copy',
            addressCopied: 'Address copied',
            noMails: 'No mails yet',
            prevPage: 'Prev',
            nextPage: 'Next',
            refreshSuccess: 'Refreshed',
            mailCount: '{current} / {total} emails',
            refreshAfter: 'Auto refresh in {msg}s',
            addressRequired: 'Please enter an email address',
            loading: 'Loading...',
        },
        zh: {
            title: '快速查邮',
            placeholder: '输入邮箱地址，如 test@example.com',
            query: '查询',
            refreshMails: '刷新',
            copyAddress: '复制',
            addressCopied: '地址已复制',
            noMails: '暂无邮件',
            prevPage: '上一页',
            nextPage: '下一页',
            refreshSuccess: '已刷新',
            mailCount: '{current} / {total} 封邮件',
            refreshAfter: '{msg}秒后自动刷新',
            addressRequired: '请输入邮箱地址',
            loading: '加载中...',
        }
    }
})

const addressInput = ref('')
const currentAddress = ref('')
const loading = ref(false)
const currentPage = ref(1)
const totalCount = ref(0)
const currentMail = ref(null)
const autoRefreshCountdown = ref(30)
const timer = ref(null)

// Sync address from URL query on mount
onMounted(() => {
    if (route.query.address) {
        addressInput.value = route.query.address
        currentAddress.value = route.query.address
        fetchMails()
        startAutoRefresh()
    }
})

onBeforeUnmount(() => {
    stopAutoRefresh()
})

const startAutoRefresh = () => {
    stopAutoRefresh()
    autoRefreshCountdown.value = 30
    timer.value = setInterval(() => {
        if (currentPage.value !== 1) {
            autoRefreshCountdown.value = 30
            return
        }
        if (--autoRefreshCountdown.value <= 0) {
            fetchMails()
            autoRefreshCountdown.value = 30
        }
    }, 1000)
}

const stopAutoRefresh = () => {
    if (timer.value) {
        clearInterval(timer.value)
        timer.value = null
    }
}

const apiFetch = async (path) => {
    const response = await axios.get(`${API_BASE}${path}`, {
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status <= 500
    })
    if (response.status >= 300) {
        throw new Error(`[${response.status}]: ${response.data}`)
    }
    return response.data
}

const queryAddress = async () => {
    if (!addressInput.value.trim()) {
        message.warning(t('addressRequired'))
        return
    }
    currentAddress.value = addressInput.value.trim()
    currentPage.value = 1
    // Update URL
    router.replace({ query: { address: currentAddress.value } })
    await fetchMails()
    startAutoRefresh()
}

const fetchMails = async () => {
    if (!currentAddress.value) return
    loading.value = true
    try {
        const data = await apiFetch(
            `/open_api/quick_mails?address=${encodeURIComponent(currentAddress.value)}&limit=1&offset=${currentPage.value - 1}`
        )
        totalCount.value = data.count > 0 ? data.count : totalCount.value
        const rawMail = data.results && data.results.length > 0 ? data.results[0] : null
        currentMail.value = rawMail ? await processItem(rawMail) : null
    } catch (error) {
        console.error('Failed to fetch mails:', error)
        message.error(error.message || 'Error')
    } finally {
        loading.value = false
    }
}

const refreshMails = async () => {
    if (loading.value) return
    currentPage.value = 1
    autoRefreshCountdown.value = 30
    await fetchMails()
    message.success(t('refreshSuccess'))
}

const copyAddress = async () => {
    try {
        await navigator.clipboard.writeText(currentAddress.value)
        message.success(t('addressCopied'))
    } catch (error) {
        message.error('Copy failed')
    }
}

// Pagination
const totalPages = computed(() => Math.max(1, totalCount.value))
const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => currentPage.value < totalPages.value)
const isFirstPage = computed(() => currentPage.value === 1)

const prevPage = () => { if (canGoPrev.value) currentPage.value-- }
const nextPage = () => { if (canGoNext.value) currentPage.value++ }

watch(currentPage, () => { fetchMails() })
</script>

<template>
    <div class="quick-container">
        <!-- Search bar -->
        <n-card :bordered="false" embedded>
            <h2 style="text-align: center; margin: 0 0 16px 0;">{{ t('title') }}</h2>
            <n-input-group>
                <n-input v-model:value="addressInput" :placeholder="t('placeholder')" size="large" clearable
                    @keydown.enter="queryAddress" />
                <n-button type="primary" size="large" @click="queryAddress" :loading="loading">
                    {{ t('query') }}
                </n-button>
            </n-input-group>
        </n-card>

        <!-- Mail display -->
        <div v-if="currentAddress">
            <n-card :bordered="false" embedded>
                <div style="text-align: center; margin-bottom: 12px; font-size: 16px; font-weight: bold;">
                    {{ currentAddress }}
                </div>
                <n-flex justify="center">
                    <n-button @click="refreshMails" :loading="loading" type="primary" tertiary size="small">
                        <template #icon>
                            <n-icon><RefreshFilled /></n-icon>
                        </template>
                        {{ t('refreshMails') }}
                    </n-button>
                    <n-button @click="copyAddress" tertiary size="small">
                        <template #icon>
                            <n-icon><ContentCopyFilled /></n-icon>
                        </template>
                        {{ t('copyAddress') }}
                    </n-button>
                </n-flex>
                <div v-if="isFirstPage" style="text-align: center; margin-top: 8px;">
                    <n-text depth="3" style="font-size: 12px;">
                        {{ t('refreshAfter', { msg: Math.max(0, autoRefreshCountdown) }) }}
                    </n-text>
                </div>
            </n-card>

            <n-card :bordered="false" embedded style="text-align: left;">
                <!-- Pagination -->
                <div v-if="totalCount > 1">
                    <n-flex justify="space-between">
                        <n-button @click="prevPage" :disabled="!canGoPrev" text size="small">
                            <template #icon>
                                <n-icon><ArrowBackIosNewFilled /></n-icon>
                            </template>
                            {{ t('prevPage') }}
                        </n-button>
                        <n-text size="small">
                            {{ t('mailCount', { current: currentPage, total: totalCount }) }}
                        </n-text>
                        <n-button @click="nextPage" :disabled="!canGoNext" text size="small" icon-placement="right">
                            <template #icon>
                                <n-icon><ArrowForwardIosFilled /></n-icon>
                            </template>
                            {{ t('nextPage') }}
                        </n-button>
                    </n-flex>
                </div>

                <!-- Mail content -->
                <div v-if="loading && !currentMail" style="text-align: center; padding: 40px;">
                    <n-spin />
                </div>
                <div v-else-if="!currentMail" class="no-mail">
                    <n-empty :description="t('noMails')" />
                </div>
                <div v-else>
                    <h3 v-if="currentMail.subject">{{ currentMail.subject }}</h3>
                    <div style="margin-top: 16px;">
                        <MailContentRenderer :mail="currentMail" :showEMailTo="false" :showReply="false"
                            :enableUserDeleteEmail="false" :showSaveS3="false" />
                    </div>
                </div>
            </n-card>
        </div>
    </div>
</template>

<style scoped>
.quick-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.n-card {
    margin-top: 16px;
    width: 100%;
}

.no-mail {
    padding: 40px 0;
}
</style>
